// Explicit live integration check. Uses disposable accounts and synthetic files only.
// Never publishes posts. Restores the upload switch and removes completed fixtures.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { initializeApp as initializeAdmin, applicationDefault } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage as adminStorage } from 'firebase-admin/storage';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const [project, fixtureDir] = process.argv.slice(2);
if (project !== 'earlyworld-6831c' || !fixtureDir)
  throw Error('Usage: node scripts/verify-social-media.mjs earlyworld-6831c FIXTURE_DIRECTORY');
const bucketName = `${project}.firebasestorage.app`;
initializeAdmin({
  credential: applicationDefault(),
  projectId: project,
  storageBucket: bucketName,
});
const db = getFirestore(),
  bucket = adminStorage().bucket();
const apiKey = execFileSync(
  '/usr/bin/plutil',
  ['-extract', 'API_KEY', 'raw', 'GoogleService-Info.plist'],
  { encoding: 'utf8' },
).trim();
const app = initializeApp(
  { apiKey, projectId: project, storageBucket: bucketName },
  'media-validation',
);
const auth = getAuth(app),
  functions = getFunctions(app, 'us-central1'),
  storage = getStorage(app);
const call = async (name, data = {}) => (await httpsCallable(functions, name)(data)).data;
const uid = `media_validation_${randomUUID().replaceAll('-', '')}`;
const email = `${uid}@example.com`,
  password = randomUUID();
const control = db.doc('_socialControl/config');
const original = (await control.get()).data();
assert.equal(original?.creation, false, 'Run only while public creation is disabled');
assert.equal(original?.publication, false, 'Run only while publication is disabled');
const fixtures = [
  ['photo', 'photo.jpg', 'image/jpeg', 'ready'],
  ['video', 'silent.mp4', 'video/mp4', 'ready'],
  ['video', 'rotated.mp4', 'video/mp4', 'ready'],
  ['video', 'too-short.mp4', 'video/mp4', 'failed'],
].map(([kind, filename, mime, expected], i) => ({
  kind,
  filename,
  mime,
  expected,
  id: `${uid}_${i}`,
  mediaId: `${uid}_media_${i}`,
}));
let created = false,
  finished = false;
// Keep Node alive while gRPC reconnects after a temporary network interruption.
const keepAlive = setInterval(() => {}, 1000);
try {
  await adminAuth().createUser({ uid, email, password, emailVerified: true });
  created = true;
  await adminAuth().setCustomUserClaims(uid, { admin: true });
  await db.doc(`users/${uid}`).set({ username: 'Media validation', onboardingComplete: true });
  await db.doc(`_socialAccounts/${uid}`).set({ eligible: true });
  await signInWithEmailAndPassword(auth, email, password);
  await control.update({ uploads: true });
  for (const f of fixtures) {
    const content = {
      kind: f.kind === 'photo' ? 'post' : 'video',
      text: '',
      scenes: [],
      attachment: null,
      mediaIds: [],
    };
    await call('savePostDraft', { id: f.id, content });
    const bytes = await readFile(`${fixtureDir}/${f.filename}`);
    const ticket = await call('authorizePostUpload', {
      postId: f.id,
      id: f.mediaId,
      kind: f.kind,
      bytes: bytes.length,
      mime: f.mime,
    });
    const upload = uploadBytesResumable(ref(storage, ticket.path), bytes, {
      contentType: f.mime,
    });
    await new Promise((resolve, reject) => upload.on('state_changed', undefined, reject, resolve));
    await assert.rejects(getDownloadURL(ref(storage, ticket.path)), {
      code: 'storage/unauthorized',
    });
    // Give finalization a chance to run; the explicit completion endpoint remains the retry fallback.
    const deadline = Date.now() + 45000;
    while (
      Date.now() < deadline &&
      (await db.doc(`_socialMedia/${f.mediaId}`).get()).data()?.status === 'authorized'
    )
      await new Promise((resolve) => setTimeout(resolve, 1000));
    f.triggerObserved =
      (await db.doc(`_socialMedia/${f.mediaId}`).get()).data()?.status !== 'authorized';
    await call('completePostUpload', { id: f.mediaId });
    if ((await bucket.file(ticket.path).exists())[0]) {
      const [originalMetadata] = await bucket.file(ticket.path).getMetadata();
      assert.ok(
        !originalMetadata.metadata?.firebaseStorageDownloadTokens,
        'Original token must be revoked before processing',
      );
    }
    await call('savePostDraft', { id: f.id, content: { ...content, mediaIds: [f.mediaId] } });
    await call('submitPost', { id: f.id, rightsConfirmed: true });
    await assert.rejects(call('getPost', { id: f.id }), { code: 'functions/not-found' });
    console.log(`Uploaded synthetic ${f.filename}; awaiting processing.`);
  }
  const deadline = Date.now() + 12 * 60000;
  let previous = '';
  while (Date.now() < deadline) {
    const states = await Promise.all(
      fixtures.map(async (f) => (await db.doc(`_socialMedia/${f.mediaId}`).get()).data()?.status),
    );
    const summary = states.join(',');
    if (summary !== previous) {
      console.log(`Processing states: ${summary}`);
      previous = summary;
    }
    if (states.every((s) => s === 'ready' || s === 'failed')) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  const results = [];
  for (const f of fixtures) {
    const media = (await db.doc(`_socialMedia/${f.mediaId}`).get()).data();
    assert.equal(media.status, f.expected, `${f.filename}: ${media.errorCode || media.status}`);
    assert.equal(f.triggerObserved, true, 'Storage finalization did not advance the ticket');
    assert.equal((await db.doc(`posts/${f.id}`).get()).exists, false);
    if (f.expected === 'failed') {
      assert.equal(media.errorCode, 'invalid-video');
      results.push({ filename: f.filename, rejected: true });
      continue;
    }
    const post = await call('getPost', { id: f.id, own: true });
    assert.equal(post.status, 'pending');
    const unsigned = await fetch(
      `https://storage.googleapis.com/${bucketName}/${media.displayPath}`,
    );
    assert.ok([401, 403].includes(unsigned.status), 'Processed file must remain private');
    assert.equal((await bucket.file(media.path).exists())[0], false, 'Source must be removed');
    const signed = await fetch(post.media[0].url, {
      headers: f.kind === 'video' ? { Range: 'bytes=0-1023' } : {},
    });
    assert.equal(signed.status, f.kind === 'video' ? 206 : 200);
    if (f.kind === 'video') {
      const full = await fetch(post.media[0].url);
      await writeFile(
        `${fixtureDir}/processed-${f.filename}`,
        Buffer.from(await full.arrayBuffer()),
      );
      const [low] = await bucket.file(media.lowPath).download();
      await writeFile(`${fixtureDir}/low-${f.filename}`, low);
    }
    results.push({
      filename: f.filename,
      private: true,
      range: signed.status,
      sourceRemoved: true,
      duration: media.duration,
      width: media.width,
      height: media.height,
    });
  }
  finished = true;
  await writeFile(`${fixtureDir}/result.json`, JSON.stringify(results, null, 2));
  console.log(
    'Private upload, processing, source cleanup, pending privacy and signed range requests passed.',
  );
} catch (error) {
  console.error(
    'Media integration check failed:',
    error.code || error.name,
    error instanceof assert.AssertionError
      ? error.message
      : 'See cloud operational status; content and credentials omitted.',
  );
  if (String(error.code).startsWith('storage/')) {
    const response = String(error.customData?.serverResponse || '')
      .replace(/https?:\/\/[^\s"']+/g, '[url]')
      .replace(/(Bearer|Firebase)\s+[A-Za-z0-9_.-]+/g, '$1 [redacted]');
    console.error('Storage response:', error.status, response.slice(0, 1000));
  }
  process.exitCode = 1;
} finally {
  await control.update({ uploads: original.uploads === true });
  if (created) {
    if (finished) {
      for (const f of fixtures) {
        await bucket.deleteFiles({ prefix: `social-processed/${f.mediaId}/` });
        await bucket
          .file(`social-staging/${uid}/${f.id}/${f.mediaId}`)
          .delete({ ignoreNotFound: true });
        for (const path of [
          `_postDrafts/${f.id}`,
          `_socialMedia/${f.mediaId}`,
          `_mediaJobs/${f.mediaId}`,
          `_moderation/post_${f.id}`,
        ])
          await db.doc(path).delete();
      }
      await db.recursiveDelete(db.doc(`users/${uid}`));
      await db.doc(`_socialAccounts/${uid}`).delete();
      await adminAuth().deleteUser(uid);
    } else {
      // Use the normal deletion pipeline if a job might still be producing objects.
      await call('requestAccountDeletion').catch(() => {});
      await writeFile(
        `${fixtureDir}/cleanup-${uid}.json`,
        JSON.stringify({
          uid,
          postIds: fixtures.map((f) => f.id),
          mediaIds: fixtures.map((f) => f.mediaId),
        }),
      );
      console.log('Failed fixture cleanup queued; manifest retained for verification.');
    }
  }
  await signOut(auth);
  await deleteApp(app);
  await db.terminate();
  clearInterval(keepAlive);
}
