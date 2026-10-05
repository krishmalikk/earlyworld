import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
process.env.GCLOUD_PROJECT = 'demo-earlyworld-catalog-search';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Use an isolated emulator.');
const { db } = await import('../functions/src/core.ts');
const { indexCatalogDocument, searchCatalogPage, searchCatalog, maintainCatalogSearch } =
  await import('../functions/src/catalog-search.ts');
const { catalogIndex } = await import('../shared/catalog-search.ts');
beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-earlyworld-catalog-search/databases/(default)/documents`,
    { method: 'DELETE' },
  );
});
after(() => db.terminate());
test('cold migration is resumable, creates a full catalog index, preserves all originals', async () => {
  const track = {
    title: 'Deep Cut',
    artistId: 'a',
    artistName: 'Singer',
    ratingCount: 4,
    saveCount: 6,
    credits: { producers: ['Co-producer'] },
  };
  await db.doc('artists/a').set({ name: 'Singer', scenes: ['plugg'] });
  await db.doc('tracks/old-track').set(track);
  await maintainCatalogSearch();
  await maintainCatalogSearch();
  assert.equal((await db.doc('_catalogControl/search').get()).data()!.ready, true);
  assert.deepEqual((await db.doc('tracks/old-track').get()).data(), track);
  const found = await searchCatalogPage({ kind: 'tracks', text: 'deep', scenes: ['plugg'] });
  assert.deepEqual(found.ids, ['old-track']);
  assert.deepEqual((await searchCatalogPage({ kind: 'tracks', producerName: 'Co-producer' })).ids, [
    'old-track',
  ]);
});
test('search beyond page one has stable cursors and neither skips nor duplicates matching tracks', async () => {
  await db.doc('_catalogControl/search').set({ ready: true });
  const batch = db.batch();
  for (let i = 0; i < 83; i++)
    batch.set(db.doc(`_catalogSearch/tracks_${String(i).padStart(3, '0')}`), {
      ...catalogIndex('tracks', { title: 'Same Song' }),
      sourceId: String(i),
    });
  await batch.commit();
  const ids: string[] = [];
  let after: string | null = null;
  do {
    const page = await searchCatalogPage({ kind: 'tracks', text: 'same', after });
    ids.push(...page.ids);
    after = page.nextCursor;
  } while (after);
  assert.equal(ids.length, 83);
  assert.equal(new Set(ids).size, 83);
  assert.ok(ids.includes('82'));
});
test('bounded empty candidate pages return a continuation, never a false end of search', async () => {
  await db.doc('_catalogControl/search').set({ ready: true });
  const batch = db.batch();
  for (let i = 0; i < 251; i++)
    batch.set(db.doc(`_catalogSearch/tracks_${String(i).padStart(3, '0')}`), {
      ...catalogIndex('tracks', { title: i === 250 ? 'abc needle' : 'abc other' }),
      sourceId: String(i),
    });
  await batch.commit();
  const first = await searchCatalogPage({ kind: 'tracks', text: 'abc needle' });
  assert.deepEqual(first.ids, []);
  assert.equal(first.scanned, 250);
  assert.ok(first.nextCursor);
  const second = await searchCatalogPage({
    kind: 'tracks',
    text: 'abc needle',
    after: first.nextCursor,
  });
  assert.deepEqual(second.ids, ['250']);
  assert.equal(second.nextCursor, null);
});
test('removed and unavailable metadata disappears from search without deleting community records', async () => {
  await db.doc('_catalogControl/search').set({ ready: true });
  const track = db.doc('tracks/track');
  await track.set({ title: 'Song', ratingCount: 5 });
  await indexCatalogDocument('tracks', 'track');
  await track.update({ sourceStatus: 'unavailable' });
  await indexCatalogDocument('tracks', 'track');
  assert.deepEqual((await searchCatalogPage({ kind: 'tracks', text: 'song' })).ids, []);
  assert.equal((await track.get()).data()!.ratingCount, 5);
  await track.delete();
  await indexCatalogDocument('tracks', 'track');
  assert.equal((await db.doc('_catalogSearch/tracks_track').get()).exists, false);
});
test('unready index and unauthorized calls fail explicitly; malformed filters are rejected', async () => {
  await assert.rejects(searchCatalogPage({ kind: 'tracks', text: 'song' }), /being prepared/);
  await assert.rejects(searchCatalog.run({ data: { kind: 'tracks' } } as never), /Sign in/);
  await assert.rejects(searchCatalogPage({ kind: 'tracks', after: '../bad' }), /cursor/);
  await assert.rejects(searchCatalogPage({ kind: 'tracks', scenes: ['x'.repeat(81)] }), /scenes/);
});

test('social-only updates do not rewrite the search projection', async () => {
  const track = db.doc('tracks/t');
  await track.set({ title: 'Song', saveCount: 0 });
  await indexCatalogDocument('tracks', 't');
  const before = await db.doc('_catalogSearch/tracks_t').get();
  await track.update({ saveCount: 7 });
  await indexCatalogDocument('tracks', 't');
  const after = await db.doc('_catalogSearch/tracks_t').get();
  assert.ok(before.updateTime!.isEqual(after.updateTime!));
});

test('artist scene reindex resumes across collections and refreshes dependent filters', async () => {
  await db.doc('artists/a').set({ name: 'Artist', scenes: ['plugg'] });
  await db.doc('tracks/t').set({ title: 'Song', artistId: 'a' });
  await indexCatalogDocument('tracks', 't');
  await db.doc('_catalogControl/search').set({ ready: true });
  await db.doc('artists/a').update({ scenes: ['rage'] });
  await db
    .doc('_catalogReindex/a')
    .set({ tracks: { complete: false }, releases: { complete: false } });
  await maintainCatalogSearch();
  await maintainCatalogSearch();
  await maintainCatalogSearch();
  assert.deepEqual((await searchCatalogPage({ kind: 'tracks', scenes: ['rage'] })).ids, ['t']);
  assert.deepEqual((await searchCatalogPage({ kind: 'tracks', scenes: ['plugg'] })).ids, []);
  assert.equal((await db.doc('_catalogReindex/a').get()).exists, false);
});
