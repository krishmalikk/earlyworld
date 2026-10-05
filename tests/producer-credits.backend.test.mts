import { beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
process.env.GCLOUD_PROJECT = 'demo-earlyworld-producer-tests';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Use an isolated Firestore emulator.');
const { db } = await import('../functions/src/core.ts');
const { syncProducerPage, syncProducerCredits, production, GeniusError } =
  await import('../functions/src/producer-credits.ts');
const artist = {
  id: 7,
  name: 'Producer',
  url: 'https://genius.com/artists/Producer',
  image_url: 'https://images.genius.com/photo.jpg',
  description: { plain: 'Producer biography.' },
};
const song = {
  id: 1,
  title: 'Song',
  url: 'https://genius.com/song-lyrics',
  primary_artist: { id: 3, name: 'Rapper' },
  producer_artists: [artist, { id: 8, name: 'Co-producer' }],
};
const ref = db.doc('producers/p');
const request = async (path: string) =>
  path.includes('/songs?')
    ? { response: { songs: [song, { ...song, id: 2 }], next_page: null } }
    : path.startsWith('/artists/')
      ? { response: { artist } }
      : {
          response: { song: path === '/songs/2' ? { ...song, id: 2, producer_artists: [] } : song },
        };
beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-earlyworld-producer-tests/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await ref.set({ name: artist.name, aliases: [], trackCount: 12 });
  await db
    .doc('tracks/t')
    .set({ producerId: 'p', geniusId: 1, title: 'Song', saveCount: 5, ratingCount: 3 });
});
after(async () => db.terminate());
test('verifies producer IDs and co-producers, never performer-only associations', () => {
  assert.ok(production(song, 7));
  assert.ok(production(song, 8));
  assert.equal(production(song, 3), null);
  assert.throws(() => production({ ...song, producer_artists: undefined }, 7), /Incomplete/);
  assert.throws(() => production({ ...song, url: 'https://evil.example/song' }, 7), /Invalid/);
});
test('sync resolves identity from credits, persists only productions and leaves social data alone', async () => {
  const before = (await db.doc('tracks/t').get()).data();
  assert.deepEqual(await syncProducerPage('p', request), { complete: true, added: 1, checked: 2 });
  assert.equal((await ref.collection('productions').get()).size, 1);
  const data = (await ref.get()).data()!;
  assert.equal(data.geniusId, 7);
  assert.equal(data.trackCount, 12);
  assert.equal(data.geniusSync.verifiedCount, 1);
  assert.equal(data.biography, artist.description.plain);
  assert.deepEqual((await db.doc('tracks/t').get()).data(), before);
  await syncProducerPage('p', async () => {
    throw Error('Completed sync must not call API');
  });
});
test('checkpoint pagination deduplicates repeated songs and resumes the next page', async () => {
  await syncProducerPage('p', async (path) =>
    path.includes('/songs?') ? { response: { songs: [song], next_page: 2 } } : request(path),
  );
  await syncProducerPage('p', async (path) => {
    if (path.includes('/songs?')) {
      assert.match(path, /page=2$/);
      return { response: { songs: [song], next_page: null } };
    }
    return request(path);
  });
  assert.equal((await ref.get()).data()!.geniusSync.verifiedCount, 1);
});
test('429 preserves the checkpoint and applies a cooldown; no automatic provider retry', async () => {
  const before = (await ref.get()).data();
  await assert.rejects(
    syncProducerPage('p', async () => {
      throw new GeniusError(429, 60);
    }),
    /429/,
  );
  assert.deepEqual((await ref.get()).data(), before);
  let called = false;
  await assert.rejects(
    syncProducerPage('p', async (path) => {
      called = true;
      return request(path);
    }),
    /rate limited/,
  );
  assert.equal(called, false);
});
test('invalid pagination, mismatched song IDs and ambiguous identities cannot checkpoint', async () => {
  await assert.rejects(
    syncProducerPage('p', async (path) =>
      path.includes('/songs?') ? { response: { songs: [song], next_page: 1 } } : request(path),
    ),
    /pagination/,
  );
  await assert.rejects(
    syncProducerPage('p', async (path) =>
      path === '/songs/1' ? { response: { song: { ...song, id: 99 } } } : request(path),
    ),
    /identity/,
  );
  await assert.rejects(
    syncProducerPage('p', async (path) =>
      path === '/songs/1'
        ? { response: { song: { ...song, producer_artists: [artist, { ...artist, id: 9 }] } } }
        : request(path),
    ),
    /unique/,
  );
  assert.equal((await ref.get()).data()!.geniusSync, undefined);
});
test('concurrent requests serialize; unauthenticated calls and invalid paths are denied', async () => {
  let release!: () => void;
  let entered!: () => void;
  const enteredPromise = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = syncProducerPage('p', async (path) => {
    entered();
    await blocked;
    return request(path);
  });
  await enteredPromise;
  await assert.rejects(syncProducerPage('p', request), /Another producer/);
  release();
  await first;
  await assert.rejects(syncProducerPage('../users/private', request), /Invalid producer/);
  await assert.rejects(syncProducerCredits.run({ data: { producerId: 'p' } } as never), /Sign in/);
});
