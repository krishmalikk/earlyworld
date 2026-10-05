import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
process.env.GCLOUD_PROJECT = 'demo-earlyworld-genius-tests';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Use an isolated Firestore emulator.');
const { db } = await import('../functions/src/core.ts');
const { enrich, adminEnrichTrack } = await import('../functions/src/genius.ts');
const song = {
  id: 7,
  url: 'https://genius.com/example',
  title: 'Test song',
  primary_artist: { name: 'Test artist' },
  producer_artists: [{ name: 'Producer' }],
  writer_artists: [{ name: 'Writer' }],
};
const request = async (path: string) =>
  path.startsWith('/search') ? { response: { hits: [{ result: song }] } } : { response: { song } };
const ref = db.doc('tracks/track');
const base = {
  title: song.title,
  artistName: song.primary_artist.name,
  geniusStatus: 'deferred',
  credits: null,
  producerId: null,
  producerName: null,
  saveCount: 8,
  ratingCount: 4,
  ratingHalfStarSum: 31,
  savers: ['listener'],
  sourceUrl: 'https://soundcloud.com/a/b',
};
beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-earlyworld-genius-tests/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await ref.set(base);
});
after(async () => db.terminate());
test('concurrent batch enrichment is idempotent and preserves social/source fields', async () => {
  const result = await Promise.all([
    enrich('track', true, { request }),
    enrich('track', true, { request }),
  ]);
  assert.deepEqual(result.sort(), ['matched', 'skipped']);
  const track = (await ref.get()).data()!;
  for (const key of ['saveCount', 'ratingCount', 'ratingHalfStarSum', 'savers', 'sourceUrl'])
    assert.deepEqual(track[key], base[key]);
  assert.deepEqual(track.credits.producers, ['Producer']);
  assert.equal((await db.doc(`producers/${track.producerId}`).get()).data()!.trackCount, 1);
  assert.equal(
    await enrich('track', true, {
      request: async () => {
        throw new Error('must not request');
      },
    }),
    'skipped',
  );
});
test('API failure stays deferred, without erasing metadata', async () => {
  await assert.rejects(
    enrich('track', true, {
      request: async () => {
        throw new Error('Genius HTTP 429');
      },
    }),
    /429/,
  );
  assert.deepEqual((await ref.get()).data(), base);
});
test('missing and ambiguous matches do not attach credits', async () => {
  assert.equal(
    await enrich('track', true, { request: async () => ({ response: { hits: [] } }) }),
    'unmatched',
  );
  await ref.set(base);
  assert.equal(
    await enrich('track', true, {
      request: async () => ({
        response: { hits: [{ result: song }, { result: { ...song, id: 8 } }] },
      }),
    }),
    'ambiguous',
  );
  assert.equal((await ref.get()).data()!.credits, null);
});
test('editorial producer and pre-existing credits are preserved', async () => {
  await ref.update({ producerName: 'Editorial credit', producerId: 'editorial' });
  await enrich('track', true, { request });
  assert.equal((await ref.get()).data()!.producerId, 'editorial');
  assert.equal((await db.collection('producers').count().get()).data().count, 1);
  assert.ok((await ref.get()).data()!.producerIds.includes('editorial'));
  await ref.update({ geniusStatus: 'deferred' });
  assert.equal(await enrich('track', true, { request }), 'skipped');
});
test('concurrent title changes and inconsistent details prevent enrichment', async () => {
  const changed = async (path: string) => {
    await ref.update({ title: 'Changed' });
    return request(path);
  };
  assert.equal(await enrich('track', true, { request: changed }), 'skipped');
  await ref.set(base);
  await assert.rejects(
    enrich('track', true, {
      request: async (path) =>
        path.startsWith('/search') ? request(path) : { response: { song: { ...song, id: 8 } } },
    }),
    /inconsistent/,
  );
  assert.equal((await ref.get()).data()!.geniusStatus, 'deferred');
});
test('manual callable rejects non-admin users', async () => {
  await assert.rejects(
    adminEnrichTrack.run({
      data: { trackId: 'track' },
      auth: { uid: 'listener', token: {} },
    } as never),
    /Admin only/,
  );
});
