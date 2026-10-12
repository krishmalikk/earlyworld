import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.GCLOUD_PROJECT = 'demo-earlyworld-social';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Use Firestore emulator.');
const { db } = await import('../functions/src/core.ts');
const { readForYou } = await import('../functions/src/for-you.ts');
const req = (uid: string, data: unknown = {}) =>
  ({ auth: { uid, token: { email_verified: true } }, data }) as any;
const at = (n: number) => new Date(1700000000000 + n);

beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-earlyworld-social/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await db.doc('_socialControl/config').set({ playback: false });
  for (const uid of ['me', 'friend', 'stranger', 'blocked']) {
    await db.doc(`users/${uid}`).set({ username: uid, avatarUrl: '', scenes: ['plugg'] });
    await db.doc(`_socialAccounts/${uid}`).set({ eligible: true });
  }
  await db
    .doc('users/me')
    .set({ favoriteTrackIds: ['fav'], favoriteReleaseIds: [] }, { merge: true });
  await db.doc('users/me/saves/saved').set({
    artistId: 'lucki',
    artistName: 'LUCKI',
    producerId: null,
    savedAt: at(0),
  });
  await db.doc('users/me/following/friend').set({ targetType: 'user', targetId: 'friend' });
  for (const [id, artistId, artistName] of [
    ['saved', 'lucki', 'LUCKI'],
    ['fav', 'che', 'che'],
    ['lucki2', 'lucki', 'LUCKI'],
    ['unrelated', 'nobody', 'Nobody'],
  ])
    await db.doc(`tracks/${id}`).set({ title: id, artistId, artistName, producerId: null });
});
after(() => db.terminate());

test('For You returns relevant reviews and posts with reasons, newest first, and skips the rest', async () => {
  const rate = (id: string, uid: string, trackId: string, review: string, n: number) =>
    db
      .doc(`ratings/${id}`)
      .set({ uid, trackId, halfStars: 8, review, createdAt: at(n), updatedAt: at(n) });
  await rate('r1', 'stranger', 'saved', 'Hard.', 1);
  await rate('r2', 'stranger', 'fav', 'Classic.', 2);
  await rate('r3', 'stranger', 'lucki2', 'Ski!', 3);
  await rate('r4', 'stranger', 'unrelated', 'Mid.', 4); // not related
  await rate('r5', 'stranger', 'saved', '', 5); // bare stars from a stranger
  await rate('r6', 'friend', 'unrelated', '', 6); // bare stars from a follow
  await rate('r7', 'me', 'fav', 'Mine.', 7); // own
  await rate('r8', 'blocked', 'saved', 'Hidden.', 8);
  const { hash } = await import('../functions/src/core.ts');
  await db.doc(`_socialBlocks/${hash('me:blocked')}`).set({ at: at(0) });
  await db.doc('posts/p1').set({
    uid: 'stranger',
    kind: 'post',
    text: 'LUCKI tape soon',
    scenes: [],
    mediaIds: [],
    attachment: { kind: 'artist', id: 'lucki', label: 'LUCKI' },
    status: 'published',
    publishedAt: at(9),
    updatedAt: at(9),
  });
  const page = await readForYou.run(req('me'));
  assert.deepEqual(
    page.items.map((i: any) => [i.type, i.data.id, i.reason]),
    [
      ['post', 'p1', 'Mentions LUCKI, who you listen to'],
      ['rating', 'r6', 'From someone you follow'],
      ['rating', 'r3', 'Review of LUCKI, who you listen to'],
      ['rating', 'r2', 'Review of one of your favorite tracks'],
      ['rating', 'r1', 'Review of a track you saved'],
    ],
  );
  assert.equal(page.cursor, null);
});

test('For You pages through more than one page without repeats', async () => {
  const batch = db.batch();
  for (let i = 0; i < 40; i++)
    batch.set(db.doc(`ratings/r${i}`), {
      uid: 'stranger',
      trackId: 'saved',
      halfStars: 6,
      review: `Take ${i}`,
      createdAt: at(i),
      updatedAt: at(i),
    });
  await batch.commit();
  const first = await readForYou.run(req('me'));
  const second = await readForYou.run(req('me', { cursor: first.cursor }));
  assert.equal(first.items.length, 25);
  assert.equal(second.items.length, 15);
  assert.equal(new Set([...first.items, ...second.items].map((i: any) => i.data.id)).size, 40);
});
