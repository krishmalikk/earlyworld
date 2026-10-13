import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.GCLOUD_PROJECT = 'demo-earlyworld-social';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Use Firestore emulator.');
const { db } = await import('../functions/src/core.ts');
const api = await import('../functions/src/social.ts');
const req = (uid: string, data: unknown = {}, admin = false) =>
  ({ auth: { uid, token: { email_verified: true, admin } }, data }) as any;
const content = (text = 'A discovery') => ({
  kind: 'post',
  text,
  scenes: ['plugg'],
  mediaIds: [],
  attachment: null,
});
const save = (id = 'one', text = 'A discovery', uid = 'alice') =>
  api.savePostDraft.run(req(uid, { id, content: content(text) }));
const submit = (id = 'one', uid = 'alice') =>
  api.submitPost.run(req(uid, { id, rightsConfirmed: true }));
beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-earlyworld-social/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await db
    .doc('_socialControl/config')
    .set({ creation: true, uploads: true, publication: true, playback: false });
  for (const uid of ['alice', 'bob', 'mod']) {
    await db.doc(`users/${uid}`).set({ username: uid, avatarUrl: '', onboardingComplete: true });
    await db.doc(`_socialAccounts/${uid}`).set({ eligible: true });
  }
});
after(() => db.terminate());
test('following pages merge more than 30 authors without losing or duplicating posts', async () => {
  const batch = db.batch();
  for (let i = 0; i < 37; i++) {
    const uid = `artist${i}`,
      id = `followed${i}`;
    batch.set(db.doc(`users/bob/following/${uid}`), { targetType: 'user', targetId: uid });
    batch.set(db.doc(`posts/${id}`), {
      ...content(),
      uid,
      status: 'published',
      publishedAt: new Date(1700000000000 + i),
      updatedAt: new Date(),
    });
  }
  await batch.commit();
  const first = await api.listPosts.run(req('bob', { mode: 'following' }));
  const second = await api.listPosts.run(req('bob', { mode: 'following', cursor: first.cursor }));
  assert.equal(first.items.length, 25);
  assert.equal(second.items.length, 12);
  assert.equal(first.items[0].id, 'followed36');
  assert.equal(new Set([...first.items, ...second.items].map((p) => p.id)).size, 37);
});
test('bookmarks paginate by bookmark time and do not scan only recent public posts', async () => {
  const batch = db.batch();
  for (let i = 0; i < 280; i++) {
    const id = `archive${i}`;
    batch.set(db.doc(`posts/${id}`), {
      ...content(),
      uid: 'alice',
      status: 'published',
      publishedAt: new Date(1700000000000 + i),
      updatedAt: new Date(),
    });
    if (i < 27)
      batch.set(db.doc(`users/bob/postBookmarks/${id}`), {
        postId: id,
        createdAt: new Date(1700001000000 + i),
      });
  }
  await batch.commit();
  const first = await api.listPosts.run(req('bob', { mode: 'bookmarks' }));
  const second = await api.listPosts.run(req('bob', { mode: 'bookmarks', cursor: first.cursor }));
  assert.equal(first.items.length, 25);
  assert.equal(second.items.length, 2);
  assert.equal(first.items[0].id, 'archive26');
  assert.equal(new Set([...first.items, ...second.items].map((p) => p.id)).size, 27);
});
test('blocked listeners cannot comment across the block', async () => {
  await save();
  await submit();
  await api.setUserBlock.run(req('alice', { uid: 'bob', blocked: true }));
  await assert.rejects(
    api.createPostComment.run(
      req('bob', { postId: 'one', requestId: 'blockedcomment', body: 'A comment' }),
    ),
    { code: 'not-found' },
  );
  assert.equal((await api.getPost.run(req('alice', { id: 'one' }))).commentCount, 0);
});
test('submission publishes immediately and revisions preserve publication identity', async () => {
  await save();
  assert.equal((await submit()).status, 'published');
  const p = await api.getPost.run(req('bob', { id: 'one' }));
  assert.equal(p.text, 'A discovery');
  assert.equal('reason' in p, false);
  await save('one', 'Edited');
  await submit();
  const edited = await api.getPost.run(req('bob', { id: 'one' }));
  assert.equal(edited.text, 'Edited');
  assert.equal(edited.publishedAt, p.publishedAt);
});
test('ownership, verified email, eligibility and creation flags are enforced', async () => {
  await save();
  await assert.rejects(save('one', 'Hijack', 'bob'), { code: 'permission-denied' });
  await assert.rejects(submit('one', 'bob'), { code: 'not-found' });
  await assert.rejects(
    api.savePostDraft.run({
      auth: { uid: 'alice', token: { email_verified: false } },
      data: { id: 'two', content: content() },
    } as any),
    { code: 'failed-precondition' },
  );
  await db.doc('_socialAccounts/alice').set({ eligible: false });
  await assert.rejects(save('two'), { code: 'failed-precondition' });
  await db.doc('_socialControl/config').update({ creation: false });
  await assert.rejects(save('three'), { code: 'failed-precondition' });
});
test('blank posts, invalid attachments and foreign media are rejected', async () => {
  await save('blank', '  ');
  await assert.rejects(submit('blank'), { code: 'invalid-argument' });
  await assert.rejects(
    api.savePostDraft.run(
      req('alice', {
        id: 'bad',
        content: { ...content(), attachment: { kind: 'track', id: 'missing' } },
      }),
    ),
    { code: 'not-found' },
  );
  await db.doc('_socialMedia/foreign').set({ uid: 'bob', postId: 'bad', kind: 'photo' });
  await assert.rejects(
    api.savePostDraft.run(
      req('alice', { id: 'bad', content: { ...content(), mediaIds: ['foreign'] } }),
    ),
    { code: 'invalid-argument' },
  );
});
test('concurrent likes are idempotent and independent bookmarks remain private', async () => {
  await save();
  await submit();
  await Promise.all(
    Array.from({ length: 5 }, () =>
      api.setPostInteraction.run(req('bob', { id: 'one', kind: 'like', active: true })),
    ),
  );
  assert.equal((await api.getPost.run(req('alice', { id: 'one' }))).likeCount, 1);
  await api.setPostInteraction.run(req('bob', { id: 'one', kind: 'bookmark', active: true }));
  assert.equal((await api.getPost.run(req('alice', { id: 'one' }))).bookmarked, false);
  assert.equal((await api.listPosts.run(req('bob', { mode: 'bookmarks' }))).items.length, 1);
  await api.setPostInteraction.run(req('bob', { id: 'one', kind: 'like', active: false }));
  assert.equal((await api.getPost.run(req('alice', { id: 'one' }))).likeCount, 0);
});
test('comments publish immediately and repeat requests/deletion do not drift counts', async () => {
  await save();
  await submit();
  const c = await api.createPostComment.run(
    req('bob', { postId: 'one', requestId: 'comment1', body: 'Nice find' }),
  );
  await api.createPostComment.run(
    req('bob', { postId: 'one', requestId: 'comment1', body: 'Nice find' }),
  );
  assert.equal(c.status, 'approved');
  assert.equal((await api.listPostComments.run(req('alice', { postId: 'one' }))).items.length, 1);
  assert.equal((await api.getPost.run(req('alice', { id: 'one' }))).commentCount, 1);
  await api.deleteSocialContent.run(req('bob', { id: c.id, kind: 'comment' }));
  await api.deleteSocialContent.run(req('bob', { id: c.id, kind: 'comment' }));
  assert.equal((await api.getPost.run(req('alice', { id: 'one' }))).commentCount, 0);
});
test('blocking works in both directions including post detail and interactions', async () => {
  await save();
  await submit();
  await api.setUserBlock.run(req('bob', { uid: 'alice', blocked: true }));
  await assert.rejects(api.getPost.run(req('bob', { id: 'one' })), { code: 'not-found' });
  assert.equal(
    (await api.listPosts.run(req('bob', { mode: 'profile', uid: 'alice' }))).items.length,
    0,
  );
  await assert.rejects(
    api.setPostInteraction.run(req('bob', { id: 'one', kind: 'like', active: true })),
    { code: 'not-found' },
  );
  await api.setUserBlock.run(req('bob', { uid: 'alice', blocked: false }));
  assert.equal((await api.getPost.run(req('bob', { id: 'one' }))).uid, 'alice');
});
test('deleting a published post cannot resurrect it', async () => {
  await save();
  await submit();
  await api.deleteSocialContent.run(req('alice', { id: 'one', kind: 'post' }));
  await assert.rejects(api.getPost.run(req('alice', { id: 'one' })), { code: 'not-found' });
  await assert.rejects(save(), { code: 'failed-precondition' });
});
test('25-item pagination has no duplicates', async () => {
  for (let i = 0; i < 27; i++)
    await db.doc(`posts/p${i.toString().padStart(2, '0')}`).set({
      ...content(),
      uid: 'alice',
      status: 'published',
      version: 1,
      publishedAt: new Date(1700000000000 + i),
      updatedAt: new Date(),
    });
  const a = await api.listPosts.run(req('bob'));
  const b = await api.listPosts.run(req('bob', { cursor: a.cursor }));
  assert.equal(a.items.length, 25);
  assert.equal(b.items.length, 2);
  assert.equal(new Set([...a.items, ...b.items].map((p) => p.id)).size, 27);
});
test('identical submission retries count only once against the daily limit', async () => {
  await save();
  await Promise.all([submit(), submit(), submit()]);
  const quotas = await db.collection('_socialQuotas').get();
  assert.equal(
    quotas.docs.reduce((n, d) => n + d.data().count, 0),
    1,
  );
});
test('US 13+ eligibility stores an age band instead of exact age', async () => {
  await assert.rejects(
    api.setSocialEligibility.run(req('alice', { age: 12, country: 'US', agreed: true })),
    { code: 'failed-precondition' },
  );
  await api.setSocialEligibility.run(req('alice', { age: 14, country: 'US', agreed: true }));
  const account = (await db.doc('_socialAccounts/alice').get()).data()!;
  assert.equal(account.ageBand, '13-17');
  assert.equal('age' in account, false);
});
test('saving and submitting identical published content is a no-op', async () => {
  await save();
  assert.equal((await submit()).status, 'published');
  const version = (await db.doc('_postDrafts/one').get()).data()!.version;
  await save();
  assert.equal((await submit()).status, 'published');
  assert.equal((await db.doc('_postDrafts/one').get()).data()!.version, version);
  const q = await db.collection('_socialQuotas').get();
  assert.equal(
    q.docs.reduce((n, d) => n + d.data().count, 0),
    1,
  );
});
test('reports distinguish the reporter from the reported account', async () => {
  await save();
  await submit();
  await api.reportSocialContent.run(
    req('bob', { kind: 'post', id: 'one', reason: 'Rights concern' }),
  );
  const [report] = (await db.collection('_socialReports').get()).docs.map((d) => d.data());
  assert.equal(report.uid, 'bob');
  assert.equal(report.subjectUid, 'alice');
});
test('review text publishes immediately; revisions replace it and counts stay exact', async () => {
  const { setTrackRating, ratingId } = await import('../functions/src/ratings.ts');
  await db.doc('tracks/t').set({ title: 'Track' });
  const set = (review: string, halfStars = 8) =>
    setTrackRating.run(req('alice', { trackId: 't', halfStars, review }));
  const rating = async () => (await db.doc(`ratings/${ratingId('alice', 't')}`).get()).data()!;
  assert.equal((await set('First take')).reviewPending, false);
  assert.equal((await rating()).review, 'First take');
  assert.equal((await db.doc('users/alice').get()).data()!.reviewCount, 1);
  await set('New take', 6);
  assert.equal((await rating()).review, 'New take');
  assert.equal((await rating()).halfStars, 6);
  assert.equal((await db.doc('users/alice').get()).data()!.reviewCount, 1);
  await set('');
  assert.equal((await db.doc('users/alice').get()).data()!.reviewCount, 0);
});
test('legacy review, profile, discussion and leaderboard reads enforce bidirectional blocking', async () => {
  const { readCommunity } = await import('../functions/src/social-reads.ts');
  await db.doc('ratings/r').set({
    uid: 'alice',
    trackId: 't',
    halfStars: 8,
    review: 'Approved',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db
    .doc('tracks/t/comments/c')
    .set({ uid: 'alice', body: 'Approved', createdAt: new Date() });
  await db
    .doc('users/alice/rotation/a')
    .set({ uid: 'alice', entityId: 'a', score: 10, tier: 'gold' });
  assert.equal(
    (await readCommunity.run(req('bob', { kind: 'ratings', itemId: 't' }))).items.length,
    1,
  );
  await api.setUserBlock.run(req('alice', { uid: 'bob', blocked: true }));
  await assert.rejects(readCommunity.run(req('bob', { kind: 'profile', uid: 'alice' })), {
    code: 'not-found',
  });
  for (const [kind, itemId] of [
    ['ratings', 't'],
    ['trackComments', 't'],
    ['leaders', 'a'],
  ])
    assert.equal((await readCommunity.run(req('bob', { kind, itemId }))).items.length, 0);
});
test('account deletion batches reconcile authored ratings, comments and outgoing likes', async () => {
  const { deleteAccountBatch } = await import('../functions/src/social-account.ts');
  await db.doc('tracks/t').set({ ratingCount: 1, ratingHalfStarSum: 8 });
  await db.doc('ratings/r').set({ uid: 'alice', trackId: 't', halfStars: 8, review: 'Approved' });
  await db
    .doc('posts/bobs')
    .set({ uid: 'bob', status: 'published', likeCount: 1, commentCount: 1 });
  await db.doc('posts/bobs/likes/alice').set({ uid: 'alice', postId: 'bobs' });
  await db.doc('_postComments/c').set({ uid: 'alice', postId: 'bobs', status: 'approved' });
  await db.doc('_accountDeletion/alice').set({ stage: 0, complete: false });
  for (let i = 0; i < 20; i++) await deleteAccountBatch('alice');
  assert.equal((await db.doc('tracks/t').get()).data()!.ratingCount, 0);
  const post = (await db.doc('posts/bobs').get()).data()!;
  assert.equal(post.likeCount, 0);
  assert.equal(post.commentCount, 0);
});

test('username reservations are exclusive and publish immediately', async () => {
  const { reserveCommunityUsername, submitProfileText } =
    await import('../functions/src/social-account.ts');
  await db.doc('users/alice').update({ username: '', usernameLower: '', onboardingStep: 1 });
  await reserveCommunityUsername.run(req('alice', { username: 'early' }));
  await assert.rejects(reserveCommunityUsername.run(req('bob', { username: 'early' })), {
    code: 'already-exists',
  });
  assert.equal((await db.doc('users/alice').get()).data()!.username, 'early');
  await submitProfileText.run(req('alice', { bio: 'Music discoveries' }));
  const user = (await db.doc('users/alice').get()).data()!;
  assert.equal(user.username, 'early');
  assert.equal(user.bio, 'Music discoveries');
});

test('a profile photo publishes with its bio once processing finishes', async () => {
  const { submitProfileText } = await import('../functions/src/social-account.ts');
  const { advancePost } = await import('../functions/src/social-media.ts');
  await db.doc('_socialMedia/photo1').set({
    uid: 'alice',
    postId: 'profile_alice',
    kind: 'photo',
    status: 'processing',
  });
  const result = await submitProfileText.run(
    req('alice', { bio: 'New bio', photoMediaId: 'photo1' }),
  );
  assert.equal(result.status, 'pending');
  assert.equal((await db.doc('users/alice').get()).data()!.bio, undefined);
  await db.doc('_socialMedia/photo1').update({ status: 'ready' });
  await advancePost('profile_alice');
  const user = (await db.doc('users/alice').get()).data()!;
  assert.equal(user.bio, 'New bio');
  assert.equal(user.avatarMediaId, 'photo1');
});

test('blocked listener management paginates, returns only published identity, and stays owner scoped', async () => {
  const { readCommunity } = await import('../functions/src/social-reads.ts');
  const batch = db.batch();
  for (let i = 0; i < 28; i++) {
    const id = `blocked${String(i).padStart(2, '0')}`;
    batch.set(db.doc(`users/alice/blockedUsers/${id}`), {});
    if (i !== 27)
      batch.set(db.doc(`users/${id}`), {
        username: `listener${i}`,
        bio: 'Private to this view',
        email: 'never-return@example.test',
        pendingUsername: 'unapproved',
        avatarUrl: 'https://example.test/private.jpg',
      });
  }
  batch.set(db.doc('_socialAccounts/blocked25'), { suspended: true });
  batch.set(db.doc('_socialAccounts/blocked26'), { deleting: true });
  await batch.commit();
  const first = await readCommunity.run(req('alice', { kind: 'blockedUsers' }));
  const second = await readCommunity.run(
    req('alice', { kind: 'blockedUsers', cursor: first.cursor }),
  );
  assert.equal(first.items.length, 25);
  assert.equal(second.items.length, 3);
  assert.equal(second.cursor, null);
  assert.equal(new Set([...first.items, ...second.items].map((i) => i.id)).size, 28);
  assert.deepEqual(first.items[0], { id: 'blocked00', username: 'listener0' });
  for (const item of second.items) assert.equal(item.username, null);
  for (const item of [...first.items, ...second.items])
    assert.deepEqual(Object.keys(item).sort(), ['id', 'username']);
  assert.equal(
    (await readCommunity.run(req('bob', { kind: 'blockedUsers', uid: 'alice' }))).items.length,
    0,
  );
  await assert.rejects(readCommunity.run({ data: { kind: 'blockedUsers' } } as any), {
    code: 'unauthenticated',
  });
  await assert.rejects(
    readCommunity.run(req('alice', { kind: 'blockedUsers', cursor: '../private' })),
    { code: 'invalid-argument' },
  );
  await api.setUserBlock.run(req('alice', { uid: 'blocked00', blocked: false }));
  assert.equal(
    (await readCommunity.run(req('alice', { kind: 'blockedUsers' }))).items.some(
      (i) => i.id === 'blocked00',
    ),
    false,
  );
});

test('account deletion requires recent authentication and queues an idempotent owner-only request', async () => {
  const { requestAccountDeletion } = await import('../functions/src/social-account.ts');
  await assert.rejects(requestAccountDeletion.run({ data: {} } as any), {
    code: 'unauthenticated',
  });
  await assert.rejects(requestAccountDeletion.run(req('alice')), { code: 'unauthenticated' });
  assert.equal((await db.doc('_accountDeletion/alice').get()).exists, false);
  const recent = {
    auth: { uid: 'alice', token: { auth_time: Math.floor(Date.now() / 1000) } },
    data: { uid: 'bob' },
  } as any;
  await requestAccountDeletion.run(recent);
  const initial = (await db.doc('_accountDeletion/alice').get()).data();
  await requestAccountDeletion.run(recent);
  assert.deepEqual((await db.doc('_accountDeletion/alice').get()).data(), initial);
  assert.equal((await db.doc('_accountDeletion/bob').get()).exists, false);
  assert.equal((await db.doc('_socialAccounts/alice').get()).data()?.deleting, true);
  assert.equal((await db.doc('_socialAccounts/bob').get()).data()?.deleting, undefined);
});
