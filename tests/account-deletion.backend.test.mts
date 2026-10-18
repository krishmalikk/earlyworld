import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
const project = 'demo-earlyworld-social';
for (const name of [
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
])
  if (!process.env[name]) throw Error(`Requires isolated ${name}`);
process.env.GCLOUD_PROJECT = project;
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: project,
  storageBucket: `${project}.appspot.com`,
});
const { db, Timestamp, hash } = await import('../functions/src/core.ts');
const { createRequire } = await import('node:module');
const functionsRequire = createRequire(new URL('../functions/package.json', import.meta.url));
const { getAuth } = functionsRequire('firebase-admin/auth');
const { getStorage } = functionsRequire('firebase-admin/storage');
const { requestAccountDeletion, deleteAccountBatch } =
  await import('../functions/src/social-account.ts');
const { cleanPostMedia } = await import('../functions/src/social-media.ts');
const { socialContext } = await import('../functions/src/social-core.ts');
const { onSave, onFollow } = await import('../functions/src/saves.ts');
const request = (
  uid: string,
  provider: string,
  authTime: unknown = Math.floor(Date.now() / 1000),
) =>
  ({
    auth: { uid, token: { auth_time: authTime, firebase: { sign_in_provider: provider } } },
    data: {},
  }) as any;
beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${project}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${project}/accounts`,
    { method: 'DELETE' },
  );
  await getStorage().bucket().deleteFiles({ force: true });
});
after(async () => {
  await db.terminate();
});

for (const provider of ['password', 'google.com', 'apple.com']) {
  test(`${provider}: queued deletion removes Auth, content, photos and relationships; retries preserve counts`, async () => {
    const uid = 'disposable';
    await getAuth().createUser({
      uid,
      email: 'disposable@example.test',
      password: 'emulator-only-password',
    });
    // Real OAuth credential exchange and Apple revocation cannot be exercised by Auth emulator.
    const token = request(uid, provider);
    const now = Timestamp.now();
    const batch = db.batch();
    const docs: Record<string, unknown> = {
      [`users/${uid}`]: { usernameLower: 'disposable', saveCount: 1 },
      'usernames/disposable': { uid },
      [`_socialAccounts/${uid}`]: { eligible: true, ageBand: 'adult' },
      'users/other': { followerCount: 1 },
      'tracks/t': { ratingCount: 2, ratingHalfStarSum: 16, saveCount: 1, savers: [uid] },
      'releases/r': { ratingCount: 2, ratingHalfStarSum: 14 },
      'ratings/r': { uid, trackId: 't', halfStars: 8 },
      'releaseRatings/r': { uid, releaseId: 'r', halfStars: 6 },
      'posts/otherpost': { uid: 'other', status: 'published', likeCount: 1, commentCount: 1 },
      [`posts/otherpost/likes/${uid}`]: { uid },
      '_postComments/c': { uid, postId: 'otherpost', status: 'approved' },
      '_postDrafts/p': { uid, kind: 'post', status: 'published', updatedAt: now, mediaIds: ['m'] },
      'posts/p': { uid, status: 'published' },
      'users/other/postBookmarks/p': { postId: 'p' },
      [`users/${uid}/postBookmarks/otherpost`]: { postId: 'otherpost' },
      [`users/${uid}/following/other`]: { targetId: 'other', targetType: 'user' },
      'users/other/following/disposable': { targetId: uid, targetType: 'user' },
      [`users/${uid}/saves/t`]: { savedAt: now },
      [`_saveState/${hash(`${uid}:t`)}`]: { saved: true },
      [`_followState/${hash(`${uid}:other`)}`]: { following: true },
      [`tracks/t/comments/c`]: { uid },
      'activity/a': { actorUid: uid },
      [`_socialBlocks/${hash(`${uid}:other`)}`]: { uid, target: 'other' },
      [`users/other/blockedBy/${uid}`]: { uid },
    };
    for (const [path, data] of Object.entries(docs)) batch.set(db.doc(path), data as any);
    // More than a cleanup page, including orphan uploads with no draft.
    for (let i = 0; i < 27; i++)
      batch.set(db.doc(`_socialMedia/m${i}`), {
        uid,
        postId: `orphan${i}`,
        path: `social-staging/${uid}/orphan${i}/m${i}`,
        status: 'ready',
        kind: 'photo',
      });
    await batch.commit();
    await getStorage().bucket().file('social-processed/m26/display.jpg').save('emulator-image');
    await getStorage()
      .bucket()
      .file(`social-staging/${uid}/orphan26/m26`)
      .save('emulator-original');
    await getStorage().bucket().file(`avatars/${uid}`).save('emulator-avatar');
    assert.deepEqual(await requestAccountDeletion.run(token), { queued: true });
    await requestAccountDeletion.run(token);
    assert.equal((await db.collection('_accountDeletion').get()).size, 1);
    await assert.rejects(socialContext(token), { code: 'permission-denied' });
    for (let n = 0; n < 80; n++) {
      await deleteAccountBatch(uid);
      // Replay production reconciliation triggers against current state (emulator has no Functions worker).
      await onSave.run({ params: { uid, trackId: 't' } } as any);
      await onFollow.run({ params: { uid, target: 'other' } } as any);
      await cleanPostMedia.run({} as any);
      const job = (await db.doc(`_accountDeletion/${uid}`).get()).data()!;
      if (job.settleAfter)
        await db.doc(`_accountDeletion/${uid}`).update({ settleAfter: Timestamp.fromMillis(0) });
      if (job.complete) break;
    }
    assert.equal((await db.doc(`_accountDeletion/${uid}`).get()).data()?.complete, true);
    await deleteAccountBatch(uid);
    await assert.rejects(getAuth().getUser(uid), { code: 'auth/user-not-found' });
    for (const path of [
      'users/disposable',
      'usernames/disposable',
      'posts/p',
      'ratings/r',
      'releaseRatings/r',
      '_postComments/c',
      'users/other/postBookmarks/p',
      'users/other/following/disposable',
      'tracks/t/comments/c',
      'activity/a',
      'users/other/blockedBy/disposable',
    ])
      assert.equal((await db.doc(path).get()).exists, false, path);
    assert.equal((await db.collection('_socialMedia').get()).size, 0);
    assert.equal((await getStorage().bucket().getFiles())[0].length, 0);
    assert.deepEqual((await db.doc('posts/otherpost').get()).data(), {
      uid: 'other',
      status: 'published',
      likeCount: 0,
      commentCount: 0,
    });
    const track = (await db.doc('tracks/t').get()).data()!;
    assert.equal(track.ratingCount, 1);
    assert.equal(track.ratingHalfStarSum, 8);
    assert.equal(track.saveCount, 0);
    assert.deepEqual(track.savers, []);
    assert.equal((await db.doc('releases/r').get()).data()?.ratingHalfStarSum, 8);
    assert.equal((await db.doc('users/other').get()).data()?.followerCount, 0);
    assert.deepEqual((await db.doc(`_socialAccounts/${uid}`).get()).data(), {
      deleting: true,
      suspended: true,
    });
    await assert.rejects(socialContext(token), { code: 'permission-denied' });
  });
  test(`${provider}: missing, stale and malformed authentication cannot queue deletion`, async () => {
    for (const time of [
      0,
      'bad',
      Math.floor(Date.now() / 1000) - 301,
      Math.floor(Date.now() / 1000) + 600,
    ])
      await assert.rejects(requestAccountDeletion.run(request('disposable', provider, time)), {
        code: 'unauthenticated',
      });
    assert.equal((await db.collection('_accountDeletion').get()).size, 0);
  });
}
