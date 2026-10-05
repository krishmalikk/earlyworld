import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { GoogleAuth } from 'google-auth-library';
import { getStorage } from 'firebase-admin/storage';
import { db, FieldValue, hash } from './core';
import { Timestamp, touchSocial } from './social-core';

export const receivePostMedia = onObjectFinalized(
  { region: 'us-east1', retry: true },
  async (event) => {
    const file = event.data;
    const parts = file.name.split('/');
    if (parts.length !== 4 || parts[0] !== 'social-staging') return;
    const [, uid, postId, id] = parts;
    // Firebase generates this reserved token itself. Revoke its bearer link
    // before marking an original available for processing.
    try {
      await getStorage()
        .bucket(file.bucket)
        .file(file.name)
        .setMetadata({
          metadata: { firebaseStorageDownloadTokens: null },
        });
    } catch (error) {
      // A delayed duplicate can arrive after successful source cleanup.
      if ((error as { code?: number }).code === 404) return;
      throw error;
    }
    await db.runTransaction(async (tx) => {
      const ref = db.doc(`_socialMedia/${id}`),
        [media, draft] = await Promise.all([tx.get(ref), tx.get(db.doc(`_postDrafts/${postId}`))]);
      const m = media.data();
      if (!m || m.uid !== uid || m.postId !== postId || draft.data()?.status === 'deleted') return;
      if (m.status !== 'authorized') return;
      if (Number(file.size) !== m.bytes || file.contentType !== m.mime) {
        tx.update(ref, { status: 'failed', errorCode: 'invalid-file' });
        return;
      }
      tx.update(ref, { status: 'processing', generation: file.generation });
      tx.set(db.doc(`_mediaJobs/${id}`), {
        uid,
        postId,
        mediaId: id,
        state: 'pending',
        attempts: 0,
        dueAt: Timestamp.now(),
      });
      touchSocial(tx, uid);
    });
  },
);

export async function advancePost(postId: string) {
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`_postDrafts/${postId}`),
      snap = await tx.get(ref),
      p = snap.data();
    if (!p || p.status !== 'processing') return;
    const media = await Promise.all(
      p.mediaIds.map((id: string) => tx.get(db.doc(`_socialMedia/${id}`))),
    );
    if (media.some((m) => m.data()?.status === 'failed')) {
      tx.update(ref, {
        status: 'draft',
        reason: media.some((m) => m.data()?.errorCode === 'daily-cap')
          ? 'Today’s video-processing limit has been reached. Try again tomorrow.'
          : 'A file could not be processed. Remove it and choose another.',
      });
      touchSocial(tx, p.uid);
      return;
    }
    if (!media.every((m) => m.data()?.status === 'ready')) return;
    tx.update(ref, { status: 'pending', updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.doc(`_moderation/post_${postId}`), {
      kind: 'post',
      targetId: postId,
      uid: p.uid,
      version: p.version,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });
    touchSocial(tx, p.uid);
  });
}
export const processPostMedia = onSchedule(
  { schedule: 'every 1 minutes', timeoutSeconds: 300, maxInstances: 1 },
  async () => {
    const config = (await db.doc('_socialControl/config').get()).data() || {};
    const url = process.env.SOCIAL_MEDIA_WORKER_URL;
    if (config.uploads !== true || !url) return;
    const client = await new GoogleAuth().getIdTokenClient(url);
    const jobs = await db
      .collection('_mediaJobs')
      .where('dueAt', '<=', Timestamp.now())
      .orderBy('dueAt')
      .limit(5)
      .get();
    for (const job of jobs.docs) {
      const owner = crypto.randomUUID();
      const claimed = await db.runTransaction(async (tx) => {
        const s = await tx.get(job.ref),
          j = s.data();
        if (!j || !['pending', 'processing'].includes(j.state) || j.dueAt.toMillis() > Date.now())
          return false;
        tx.update(job.ref, {
          state: 'processing',
          owner,
          dueAt: Timestamp.fromMillis(Date.now() + 6 * 60000),
        });
        return true;
      });
      if (!claimed) continue;
      try {
        await client.request({ url, method: 'POST', data: { id: job.id }, timeout: 55000 });
        const media = (await db.doc(`_socialMedia/${job.id}`).get()).data();
        await db.runTransaction(async (tx) => {
          const s = await tx.get(job.ref);
          if (s.data()?.owner !== owner) return;
          tx.update(
            job.ref,
            media?.status === 'ready'
              ? { state: 'complete', dueAt: FieldValue.delete() }
              : media?.status === 'failed'
                ? { state: 'failed', dueAt: FieldValue.delete() }
                : { state: 'pending', dueAt: Timestamp.fromMillis(Date.now() + 60000) },
          );
        });
        console.info({
          event: 'media_processing',
          state: media?.status || 'missing',
          ageSeconds: Math.max(
            0,
            (Date.now() - (media?.createdAt?.toMillis() || Date.now())) / 1000,
          ),
        });
        await advancePost(job.data().postId);
      } catch {
        console.warn({ event: 'media_processing_failure' });
        await db.runTransaction(async (tx) => {
          const s = await tx.get(job.ref),
            j = s.data();
          if (j?.owner !== owner) return;
          const attempts = (j.attempts || 0) + 1;
          tx.update(job.ref, {
            attempts,
            state: attempts >= 6 ? 'failed' : 'pending',
            dueAt:
              attempts >= 6
                ? FieldValue.delete()
                : Timestamp.fromMillis(Date.now() + Math.min(3600000, 60000 * 2 ** attempts)),
            errorCode: 'processing-failed',
          });
          if (attempts >= 6)
            tx.update(db.doc(`_socialMedia/${job.id}`), {
              status: 'failed',
              errorCode: 'processing-failed',
            });
        });
        await advancePost(job.data().postId);
      }
    }
  },
);
export const cleanPostMedia = onSchedule(
  { schedule: 'every 60 minutes', timeoutSeconds: 300, maxInstances: 1 },
  async () => {
    const stale = await db
      .collection('_postDrafts')
      .where('status', 'in', ['draft', 'rejected', 'deleted'])
      .where('updatedAt', '<', Timestamp.fromMillis(Date.now() - 7 * 86400000))
      .limit(100)
      .get();
    for (const d of stale.docs)
      if (['draft', 'rejected', 'deleted'].includes(d.data().status))
        await db.doc(`_socialCleanup/${d.id}`).set({ uid: d.data().uid, postId: d.id });
    const cleanup = await db.collection('_socialCleanup').limit(25).get();
    for (const item of cleanup.docs) {
      const draft = await db.doc(`_postDrafts/${item.id}`).get();
      const published = await db.doc(`posts/${item.id}`).get();
      if (published.data()?.status === 'published') {
        await item.ref.delete();
        continue;
      }
      const account = (await db.doc(`_socialAccounts/${item.data().uid}`).get()).data();
      const profile = draft.data()?.purpose === 'profile' && !account?.deleting;
      const keep = new Set<string>();
      if (profile) {
        const user = (await db.doc(`users/${item.data().uid}`).get()).data();
        const revision = (
          await db.doc(`_textSubmissions/${hash(`profile:${item.data().uid}`)}`).get()
        ).data();
        if (user?.avatarMediaId) keep.add(user.avatarMediaId);
        if (revision?.status === 'pending' && revision.photoMediaId)
          keep.add(revision.photoMediaId);
      } else if (draft.exists) await draft.ref.update({ status: 'deleted' });
      const media = await db.collection('_socialMedia').where('postId', '==', item.id).get();
      let pending = false;
      for (const m of media.docs) {
        if (
          profile &&
          (keep.has(m.id) || (m.data().createdAt?.toMillis() || 0) > Date.now() - 7 * 86400000)
        )
          continue;
        // Wait for in-flight workers/transcodes; their final writes cannot republish this draft.
        if ((m.data().leaseUntil?.toMillis() || 0) > Date.now()) {
          pending = true;
          continue;
        }
        if (m.data().dispatchStartedAt && !m.data().jobName) {
          // An ambiguous create RPC may still be running at the provider. Keep its
          // references until the operator or processing retry reconciles the job.
          pending = true;
          continue;
        }
        if (m.data().jobName) {
          const client = await new GoogleAuth().getClient();
          const response = await client.request<{ state: string }>({
            url: `https://transcoder.googleapis.com/v1/${m.data().jobName}`,
          });
          if (!['SUCCEEDED', 'FAILED'].includes(response.data.state)) {
            pending = true;
            continue;
          }
        }
        await getStorage()
          .bucket()
          .deleteFiles({ prefix: `social-processed/${m.id}/` });
        await getStorage().bucket().file(m.data().path).delete({ ignoreNotFound: true });
        await db.doc(`_mediaJobs/${m.id}`).delete();
        await m.ref.delete();
      }
      if (draft.exists && !profile)
        await draft.ref.update({ status: 'deleted', mediaIds: [], text: '', attachment: null });
      if (!pending) {
        if (published.exists) await db.recursiveDelete(published.ref);
        const bookmarks = await db
          .collectionGroup('postBookmarks')
          .where('postId', '==', item.id)
          .get();
        for (const b of bookmarks.docs) await b.ref.delete();
        const comments = await db.collection('_postComments').where('postId', '==', item.id).get();
        for (const comment of comments.docs) {
          await db.doc(`_moderation/comment_${comment.id}`).delete();
          await comment.ref.delete();
        }
        await item.ref.delete();
      }
    }
  },
);
