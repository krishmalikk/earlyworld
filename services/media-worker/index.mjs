import { createHash } from 'node:crypto';
import http from 'node:http';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { v1 } from '@google-cloud/video-transcoder';
import sharp from 'sharp';
import { inspectVideo, videoConfig, retryTranscode } from './video-config.mjs';
initializeApp();
const db = getFirestore(),
  bucket = getStorage().bucket(process.env.MEDIA_BUCKET),
  transcoder = new v1.TranscoderServiceClient(),
  exec = promisify(execFile);
async function processMedia(id) {
  const ref = db.doc(`_socialMedia/${id}`),
    m = (await ref.get()).data();
  if (!m || m.status !== 'processing') return;
  const draft = (await db.doc(`_postDrafts/${m.postId}`).get()).data();
  if (!draft || draft.status === 'deleted') return;
  const prefix = `social-processed/${id}/`;
  const parent = transcoder.locationPath(
    process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT,
    'us-central1',
  );
  // A dispatch marker prevents an ambiguous RPC result from submitting/billing twice.
  if (m.dispatchStartedAt && !m.jobName) {
    const [jobs] = await transcoder.listJobs(
      {
        parent,
        filter: `createTime > \"${m.dispatchStartedAt.toDate().toISOString()}\"`,
        pageSize: 1000,
      },
      { autoPaginate: false },
    );
    const found = jobs.find(
      (job) => job.labels?.media === createHash('sha256').update(id).digest('hex').slice(0, 63),
    );
    if (found?.name) await ref.update({ jobName: found.name });
    else throw Error('dispatch-unconfirmed');
    return;
  }
  if (m.jobName) {
    const [job] = await transcoder.getJob({ name: m.jobName });
    if (job.state === 'FAILED') {
      await db.runTransaction(async (tx) => {
        const current = (await tx.get(ref)).data();
        if (!current || current.status !== 'processing' || current.jobName !== m.jobName) return;
        if (retryTranscode(job, current.transcodeRetries || 0)) {
          tx.update(ref, {
            transcodeRetries: (current.transcodeRetries || 0) + 1,
            jobName: FieldValue.delete(),
            dispatchStartedAt: FieldValue.delete(),
            reservedSeconds: FieldValue.delete(),
          });
        } else tx.update(ref, { status: 'failed', errorCode: 'transcode-failed' });
      });
      return;
    }
    if (job.state !== 'SUCCEEDED') return;
    await finish(ref, m, { displayPath: `${prefix}video0.mp4`, lowPath: `${prefix}video1.mp4` });
    await bucket.file(m.path).delete({ ignoreNotFound: true });
    return;
  }
  const lock = crypto.randomUUID();
  const claimed = await db.runTransaction(async (tx) => {
    const [snapshot, draft] = await Promise.all([
      tx.get(ref),
      tx.get(db.doc(`_postDrafts/${m.postId}`)),
    ]);
    const current = snapshot.data();
    if (!draft.exists || draft.data().status === 'deleted') return false;
    if (
      !current ||
      current.jobName ||
      current.dispatchStartedAt ||
      current.status !== 'processing' ||
      (current.leaseUntil?.toMillis() || 0) > Date.now()
    )
      return false;
    tx.update(ref, { lease: lock, leaseUntil: Timestamp.fromMillis(Date.now() + 5 * 60000) });
    return true;
  });
  if (!claimed) return;
  const dir = await mkdtemp(path.join(tmpdir(), 'earlyworld-media-'));
  try {
    const source = path.join(dir, 'input');
    const file = bucket.file(m.path);
    const [metadata] = await file.getMetadata();
    if (
      Number(metadata.size) !== m.bytes ||
      Number(metadata.size) > (m.kind === 'video' ? 150 : 15) * 1024 * 1024
    )
      throw Error('too-large');
    await file.download({ destination: source });
    const upload = async (local, name) => {
      await bucket.upload(local, {
        destination: prefix + name,
        metadata: { cacheControl: 'private, max-age=0, no-store' },
      });
      return prefix + name;
    };
    if (m.kind === 'photo') {
      const image = sharp(source, { limitInputPixels: 40000000 }).rotate();
      const imageInfo = await image.metadata();
      if (!['jpeg', 'png', 'webp', 'heif'].includes(imageInfo.format)) throw Error('invalid-photo');
      const display = path.join(dir, 'display.jpg'),
        thumb = path.join(dir, 'thumbnail.jpg');
      await image
        .clone()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 86 })
        .toFile(display);
      await image
        .clone()
        .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(thumb);
      await finish(ref, m, {
        displayPath: await upload(display, 'display.jpg'),
        thumbnailPath: await upload(thumb, 'thumbnail.jpg'),
        leaseUntil: FieldValue.delete(),
      });
      await file.delete({ ignoreNotFound: true });
      return;
    }
    const { stdout } = await exec(
      'ffprobe',
      [
        '-protocol_whitelist',
        'file,pipe',
        '-v',
        'error',
        '-show_streams',
        '-show_format',
        '-of',
        'json',
        source,
      ],
      { timeout: 15000, maxBuffer: 1024 * 1024 },
    );
    const info = inspectVideo(JSON.parse(stdout));
    const quota = db.doc(`_socialQuotas/global-video-${new Date().toISOString().slice(0, 10)}`);
    await db.runTransaction(async (tx) => {
      const [q, current, config] = await Promise.all([
        tx.get(quota),
        tx.get(ref),
        tx.get(db.doc('_socialControl/config')),
      ]);
      if (current.data()?.reservedSeconds) return;
      const count = (q.data()?.count || 0) + Math.ceil(info.duration);
      if (count > (config.data()?.processingSecondsDaily || 1200)) throw Error('daily-cap');
      tx.set(quota, { count, expiresAt: Timestamp.fromMillis(Date.now() + 2 * 86400000) });
      tx.update(ref, { reservedSeconds: Math.ceil(info.duration) });
    });
    const thumbnail = path.join(dir, 'thumbnail.jpg');
    await exec(
      'ffmpeg',
      [
        '-protocol_whitelist',
        'file,pipe',
        '-v',
        'error',
        '-ss',
        '0',
        '-i',
        source,
        '-frames:v',
        '1',
        '-vf',
        'scale=480:480:force_original_aspect_ratio=decrease',
        '-y',
        thumbnail,
      ],
      { timeout: 20000 },
    );
    const thumbnailPath = await upload(thumbnail, 'thumbnail.jpg');
    await ref.update({
      dispatchStartedAt: Timestamp.fromMillis(Date.now() - 1000),
      thumbnailPath,
      ...info,
    });
    const [job] = await transcoder.createJob({
      parent,
      job: {
        // Google recommends disabling optimization when retrying InternalError.
        optimization: m.transcodeRetries ? 'DISABLED' : 'AUTODETECT',
        config: videoConfig(info, `gs://${bucket.name}/${m.path}`, `gs://${bucket.name}/${prefix}`),
        labels: { media: createHash('sha256').update(id).digest('hex').slice(0, 63) },
      },
    });
    await ref.update({ jobName: job.name, leaseUntil: FieldValue.delete() });
  } finally {
    await rm(dir, { recursive: true, force: true });
    await db
      .runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (current.data()?.lease === lock) tx.update(ref, { leaseUntil: FieldValue.delete() });
      })
      .catch(() => {});
  }
}
async function finish(ref, m, fields) {
  await db.runTransaction(async (tx) => {
    const [current, draft, account] = await Promise.all([
      tx.get(ref),
      tx.get(db.doc(`_postDrafts/${m.postId}`)),
      tx.get(db.doc(`_socialAccounts/${m.uid}`)),
    ]);
    if (
      !current.exists ||
      !draft.exists ||
      draft.data().status === 'deleted' ||
      account.data()?.deleting
    ) {
      tx.set(db.doc(`_socialCleanup/${m.postId}`), { uid: m.uid, postId: m.postId });
      return;
    }
    if (current.data().status === 'ready') return;
    tx.update(ref, { ...fields, status: 'ready' });
    tx.set(db.doc(`users/${m.uid}/socialState/current`), {
      changedAt: FieldValue.serverTimestamp(),
    });
  });
}
// Cloud Run IAM authenticates invocations; this service must never allow unauthenticated access.
http
  .createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 1024) {
        res.writeHead(413).end();
        return;
      }
    }
    try {
      const { id } = JSON.parse(body);
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw Error('invalid-id');
      try {
        await processMedia(id);
      } catch (error) {
        if (
          [
            'daily-cap',
            'invalid-video',
            'invalid-container',
            'invalid-photo',
            'too-large',
          ].includes(error.message)
        ) {
          await db.doc(`_socialMedia/${id}`).update({ status: 'failed', errorCode: error.message });
        } else throw error;
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
    } catch {
      res.writeHead(500).end('Processing failed');
    }
  })
  .listen(Number(process.env.PORT) || 8080);
