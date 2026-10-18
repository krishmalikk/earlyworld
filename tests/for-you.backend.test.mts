import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.GCLOUD_PROJECT = 'demo-earlyworld-social';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Use Firestore emulator.');
const { db } = await import('../functions/src/core.ts');
const { readForYou } = await import('../functions/src/for-you.ts');
const req = (uid: string, data: unknown = {}) =>
  ({
    auth: { uid, token: { email_verified: true } },
    data: { ...(data as object), cursorVersion: 2 },
  }) as any;
const at = (n: number) => new Date(1700000000000 + n);

beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-earlyworld-social/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await db.doc('_socialControl/config').set({});
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

async function allPages() {
  const items: any[] = [];
  let cursor: unknown = null;
  const cursors = new Set();
  do {
    const page = await readForYou.run(req('me', { cursor }));
    assert.ok(page.items.length <= 25);
    items.push(...page.items);
    cursor = page.cursor;
    if (cursor) {
      assert.ok(!cursors.has(cursor), 'cursor must advance even on empty filtered pages');
      cursors.add(cursor);
    }
    assert.ok(cursors.size < 50, 'pagination must terminate');
  } while (cursor);
  return items;
}

test('ties across all sources and beyond the 120-record scan limit are returned exactly once', async () => {
  const batch = db.batch();
  for (const source of ['ratings', 'releaseRatings', 'posts']) {
    for (let i = 0; i < 125; i++) {
      const id = String(i).padStart(3, '0');
      batch.set(
        db.doc(`${source}/${id}`),
        source === 'posts'
          ? {
              uid: 'friend',
              status: 'published',
              kind: 'post',
              text: '',
              scenes: [],
              mediaIds: [],
              attachment: null,
              publishedAt: at(1),
              updatedAt: at(1),
            }
          : {
              uid: 'friend',
              trackId: 'saved',
              releaseId: 'release',
              halfStars: 8,
              review: '',
              createdAt: at(1),
              updatedAt: at(1),
            },
      );
    }
  }
  await batch.commit();
  const items = await allPages();
  assert.equal(items.length, 375);
  assert.equal(new Set(items.map((i) => `${i.type}:${i.data.id}`)).size, 375);
  assert.deepEqual(
    items.slice(0, 125).map((i) => i.type),
    Array(125).fill('releaseRating'),
  );
  assert.deepEqual(
    items.slice(0, 125).map((i) => i.data.id),
    Array.from({ length: 125 }, (_, i) => String(124 - i).padStart(3, '0')),
  );
});

test('filtered records at the scan boundary cannot hide older relevant items', async () => {
  const batch = db.batch();
  for (let i = 0; i < 121; i++)
    batch.set(db.doc(`ratings/hidden${i}`), {
      uid: 'stranger',
      trackId: 'unrelated',
      review: '',
      halfStars: 8,
      createdAt: at(2),
    });
  batch.set(db.doc('ratings/visible'), {
    uid: 'friend',
    trackId: 'saved',
    review: '',
    halfStars: 8,
    createdAt: at(1),
  });
  await batch.commit();
  const first = await readForYou.run(req('me'));
  assert.equal(first.items.length, 0);
  assert.ok(first.cursor);
  assert.deepEqual(
    (await allPages()).map((i) => i.data.id),
    ['visible'],
  );
});

test('cursor retains nanoseconds and does not require the boundary document to still exist', async () => {
  const { Timestamp } = await import('../functions/src/core.ts');
  const batch = db.batch();
  for (let i = 0; i < 30; i++)
    batch.set(db.doc(`ratings/r${i}`), {
      uid: 'friend',
      trackId: 'saved',
      halfStars: 8,
      review: '',
      createdAt: new Timestamp(1700000000, i * 1000),
    });
  await batch.commit();
  const first = await readForYou.run(req('me'));
  assert.equal((first.items[0].data as any).id, 'r29');
  await db.doc('ratings/r5').delete();
  const second = await readForYou.run(req('me', { cursor: first.cursor }));
  assert.deepEqual(
    second.items.map((i: any) => i.data.id),
    ['r4', 'r3', 'r2', 'r1', 'r0'],
  );
});

test('invalid cursors fail clearly; legacy clients still receive numeric cursors', async () => {
  await assert.rejects(readForYou.run(req('me', { cursor: 'broken' })), {
    code: 'invalid-argument',
  });
  for (let i = 0; i < 26; i++)
    await db
      .doc(`ratings/r${i}`)
      .set({ uid: 'friend', trackId: 'saved', halfStars: 8, createdAt: at(i) });
  const page = await readForYou.run({ auth: { uid: 'me', token: {} }, data: {} } as any);
  assert.equal(typeof page.cursor, 'number');
});

test('following feed pages retain timestamp precision and Firestore document-ID tie order', async () => {
  const { listPosts } = await import('../functions/src/social.ts');
  const { readCommunity } = await import('../functions/src/social-reads.ts');
  const { Timestamp } = await import('../functions/src/core.ts');
  const stamp = new Timestamp(1700000000, 123456789);
  const ids = Array.from(
    { length: 55 },
    (_, i) => `${i % 2 ? 'A' : 'a'}${String(i).padStart(3, '0')}`,
  );
  const batch = db.batch();
  for (const id of ids) {
    batch.set(db.doc(`posts/${id}`), {
      uid: 'friend',
      status: 'published',
      kind: 'post',
      mediaIds: [],
      text: '',
      scenes: [],
      publishedAt: stamp,
      updatedAt: stamp,
    });
    batch.set(db.doc(`ratings/${id}`), {
      uid: 'friend',
      trackId: 'saved',
      halfStars: 8,
      review: '',
      createdAt: stamp,
    });
  }
  await batch.commit();
  for (const read of [
    (cursor: unknown) => listPosts.run(req('me', { mode: 'following', cursor })),
    (cursor: unknown) => readCommunity.run(req('me', { kind: 'ratings', following: true, cursor })),
  ]) {
    const found: string[] = [];
    let cursor: unknown = null;
    do {
      const page = await read(cursor);
      found.push(...page.items.map((i: any) => i.id));
      cursor = page.cursor;
      assert.ok(found.length <= 55);
    } while (cursor);
    assert.deepEqual(found, ids.sort().reverse());
  }
});

test('following scan boundaries do not skip a filtered group’s unseen records', async () => {
  const { listPosts } = await import('../functions/src/social.ts');
  const batch = db.batch();
  for (let i = 0; i < 31; i++)
    batch.set(db.doc(`users/me/following/user${String(i).padStart(2, '0')}`), {
      targetType: 'user',
      targetId: `user${String(i).padStart(2, '0')}`,
    });
  for (let i = 0; i < 26; i++)
    batch.set(db.doc(`posts/a${i}`), {
      uid: 'friend',
      status: 'published',
      purpose: i < 25 ? 'profile' : null,
      kind: 'post',
      mediaIds: [],
      text: '',
      scenes: [],
      publishedAt: at(100 - i),
      updatedAt: at(100 - i),
    });
  batch.set(db.doc('posts/older'), {
    uid: 'user30',
    status: 'published',
    kind: 'post',
    mediaIds: [],
    text: '',
    scenes: [],
    publishedAt: at(1),
    updatedAt: at(1),
  });
  await batch.commit();
  const found: string[] = [];
  let cursor: unknown = null;
  let pages = 0;
  do {
    const page = await listPosts.run(req('me', { mode: 'following', cursor }));
    found.push(...page.items.map((i: any) => i.id));
    cursor = page.cursor;
    assert.ok(++pages < 10);
  } while (cursor);
  assert.deepEqual(found, ['a25', 'older']);
});
