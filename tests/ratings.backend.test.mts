import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.GCLOUD_PROJECT = 'demo-earlyworld';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Use the isolated Firestore test emulator.');
const { db, Timestamp, hash } = await import('../functions/src/core.ts');
const { setTrackRating, deleteTrackRating, setFavoriteTracks, ratingId } =
  await import('../functions/src/ratings.ts');
const { moderateSocialContent } = await import('../functions/src/social.ts');
const request = (uid: string, data: unknown) =>
  ({ auth: { uid, token: { email_verified: true } }, data }) as any;
// These aggregate regression scenarios explicitly approve submitted text.
const set = async (halfStars = 8, review = '', uid = 'alice', trackId = 't') => {
  const result = await setTrackRating.run(request(uid, { trackId, halfStars, review }));
  if (result.reviewPending)
    await moderateSocialContent.run({
      auth: { uid: 'moderator', token: { admin: true } },
      data: { id: `text_${hash(`review:ratings:${uid}:${trackId}`)}`, approve: true },
    } as any);
  return result;
};
const remove = (uid = 'alice', trackId = 't') => deleteTrackRating.run(request(uid, { trackId }));
const favorites = (trackIds: unknown, uid = 'alice') =>
  setFavoriteTracks.run(request(uid, { trackIds }));
const track = async () => (await db.doc('tracks/t').get()).data()!;
const user = async (uid = 'alice') => (await db.doc(`users/${uid}`).get()).data()!;
const rating = async (uid = 'alice', trackId = 't') =>
  (await db.doc(`ratings/${ratingId(uid, trackId)}`).get()).data();
beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-earlyworld/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await db.doc('_socialControl/config').set({ publication: true });
  for (const uid of ['alice', 'bob']) {
    await db.doc(`users/${uid}`).set({ saveCount: 7, followerCount: 2, onboardingComplete: true });
    await db.doc(`_socialAccounts/${uid}`).set({ eligible: true });
  }
  for (const id of ['t', 'u', 'v', 'w', 'x'])
    await db
      .doc(`tracks/${id}`)
      .set({ title: id, saveCount: 12, savers: ['old'], saversCapped: false });
});
after(() => db.terminate());

test('create, edit, clear review, identical retry, and delete reconcile counters without changing saves', async () => {
  await set(9, '  Great track  ');
  assert.equal((await rating())?.review, 'Great track');
  const original = (await rating())!;
  assert.deepEqual(
    [
      (await track()).ratingCount,
      (await track()).ratingHalfStarSum,
      (await user()).ratingCount,
      (await user()).reviewCount,
    ],
    [1, 9, 1, 1],
  );
  assert.deepEqual(await set(9, 'Great track'), { changed: false });
  assert.equal((await rating())!.updatedAt.toMillis(), original.updatedAt.toMillis());
  await set(5, 'Changed my mind');
  assert.equal((await rating())!.createdAt.toMillis(), original.createdAt.toMillis());
  assert.equal((await track()).ratingHalfStarSum, 5);
  await set(5, '   ');
  assert.equal((await user()).reviewCount, 0);
  await remove();
  await remove();
  assert.equal(await rating(), undefined);
  assert.deepEqual(
    [
      (await track()).ratingCount,
      (await track()).ratingHalfStarSum,
      (await user()).ratingCount,
      (await user()).reviewCount,
    ],
    [0, 0, 0, 0],
  );
  assert.equal((await track()).saveCount, 12);
  assert.deepEqual((await track()).savers, ['old']);
  assert.equal((await user()).saveCount, 7);
});

test('all ten half-star values work and invalid requests leave no rating', async () => {
  for (let i = 1; i <= 10; i++) {
    await set(i);
    assert.equal((await track()).ratingHalfStarSum, i);
  }
  for (const score of [0, 11, 2.5, '8', null])
    await assert.rejects(setTrackRating.run(request('bob', { trackId: 't', halfStars: score })), {
      code: 'invalid-argument',
    });
  await assert.rejects(set(8, 'x'.repeat(501), 'bob'), { code: 'invalid-argument' });
  await assert.rejects(set(8, '', 'bob', 'missing'), { code: 'not-found' });
  await assert.rejects(set(8, '', 'bob', 'a/b/c'), { code: 'invalid-argument' });
  assert.equal(await rating('bob'), undefined);
});

test('authentication defines ownership; a supplied uid cannot edit or delete somebody else’s rating', async () => {
  await assert.rejects(setTrackRating.run({ data: { trackId: 't', halfStars: 8 } } as any), {
    code: 'unauthenticated',
  });
  await assert.rejects(deleteTrackRating.run({ data: { trackId: 't' } } as any), {
    code: 'unauthenticated',
  });
  await assert.rejects(setFavoriteTracks.run({ data: { trackIds: [] } } as any), {
    code: 'unauthenticated',
  });
  await set(10, 'Alice');
  await setTrackRating.run(
    request('bob', { uid: 'alice', trackId: 't', halfStars: 2, review: 'Bob' }),
  );
  await deleteTrackRating.run(request('bob', { uid: 'alice', trackId: 't' }));
  assert.equal((await rating())?.review, 'Alice');
  assert.equal(await rating('bob'), undefined);
  assert.equal((await track()).ratingCount, 1);
});

test('concurrent authors and concurrent edits keep aggregates equal to authoritative ratings', async () => {
  await Promise.all([set(7, 'A'), set(10, '', 'bob')]);
  assert.equal((await track()).ratingHalfStarSum, 17);
  assert.equal((await track()).ratingCount, 2);
  await Promise.all([set(1), set(4), set(8)]);
  assert.equal(
    (await track()).ratingHalfStarSum,
    (await rating())!.halfStars + (await rating('bob'))!.halfStars,
  );
  assert.equal((await track()).ratingCount, 2);
  assert.equal((await user()).ratingCount, 1);
  await Promise.all([remove(), set(9)]);
  const remaining = await db.collection('ratings').get();
  assert.equal((await track()).ratingCount, remaining.size);
  assert.equal(
    (await track()).ratingHalfStarSum,
    remaining.docs.reduce((sum, d) => sum + d.data().halfStars, 0),
  );
});

test('favorites keep manual order and are independent of ratings and saves', async () => {
  await favorites(['w', 't', 'v', 'u']);
  assert.deepEqual((await user()).favoriteTrackIds, ['w', 't', 'v', 'u']);
  assert.deepEqual(await favorites(['w', 't', 'v', 'u']), { changed: false });
  await favorites(['u', 'w']);
  await set(1);
  await remove();
  assert.deepEqual((await user()).favoriteTrackIds, ['u', 'w']);
  assert.equal((await user()).saveCount, 7);
  for (const ids of [['t', 't'], ['t', 'u', 'v', 'w', 'x'], ['missing'], ['a/b/c'], [null], 't'])
    await assert.rejects(favorites(ids));
  await favorites([]);
  assert.deepEqual((await user()).favoriteTrackIds, []);
});

test('missing profiles are rejected and missing-track deletion can still clean up a rating', async () => {
  await assert.rejects(set(8, '', 'missing-user'), { code: 'failed-precondition' });
  await assert.rejects(favorites([], 'missing-user'), { code: 'failed-precondition' });
  await set();
  await db.doc('tracks/t').delete();
  await remove();
  assert.equal((await user()).ratingCount, 0);
  assert.equal(await rating(), undefined);
});

test('rating and favorites mutation budgets are enforced independently', async () => {
  for (let i = 0; i < 60; i++) await set(8);
  await assert.rejects(set(9), { code: 'resource-exhausted' });
  await assert.rejects(remove(), { code: 'resource-exhausted' });
  for (let i = 0; i < 30; i++) await favorites(['t']);
  await assert.rejects(favorites([]), { code: 'resource-exhausted' });
});

test('profile queries paginate and break score ties by update time; low ratings stay outside highest rated', async () => {
  const batch = db.batch();
  for (let i = 0; i < 31; i++)
    batch.set(db.doc(`ratings/fixture-${i}`), {
      uid: 'alice',
      trackId: `fixture-${i}`,
      halfStars: i < 3 ? 2 : 8,
      review: '',
      createdAt: Timestamp.fromMillis(1000 + i),
      updatedAt: Timestamp.fromMillis(1000 + i),
    });
  await batch.commit();
  const base = db.collection('ratings').where('uid', '==', 'alice');
  const recent = await base.orderBy('createdAt', 'desc').limit(25).get();
  assert.equal(recent.size, 25);
  assert.equal(recent.docs[0].id, 'fixture-30');
  assert.equal((await base.orderBy('createdAt', 'desc').limit(50).get()).size, 31);
  const highest = await base
    .where('halfStars', '>=', 8)
    .orderBy('halfStars', 'desc')
    .orderBy('updatedAt', 'desc')
    .limit(12)
    .get();
  assert.equal(highest.size, 12);
  assert.equal(highest.docs[0].id, 'fixture-30');
  const bob = await db
    .collection('ratings')
    .where('uid', '==', 'bob')
    .where('halfStars', '>=', 8)
    .orderBy('halfStars', 'desc')
    .orderBy('updatedAt', 'desc')
    .get();
  assert.equal(bob.empty, true);
});
