import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
process.env.GCLOUD_PROJECT = 'demo-earlyworld-catalog-jobs';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Use an isolated emulator.');
const { db } = await import('../functions/src/core.ts');
const { enqueueGenius, runGeniusJobs, retryTime } =
  await import('../functions/src/catalog-jobs.ts');
const { GeniusRequestError } = await import('../functions/src/genius.ts');
const song = {
  id: 1,
  title: 'Song',
  url: 'https://genius.com/song',
  primary_artist: { name: 'Artist' },
  producer_artists: [
    { id: 7, name: 'Producer' },
    { id: 8, name: 'Co-producer' },
  ],
};
const request = async (path: string) =>
  path.startsWith('/search') ? { response: { hits: [{ result: song }] } } : { response: { song } };
beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-earlyworld-catalog-jobs/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await db
    .doc('tracks/t')
    .set({
      title: 'Song',
      artistName: 'Artist',
      geniusStatus: 'deferred',
      credits: null,
      ratingCount: 3,
      saveCount: 2,
    });
  await db.doc('_catalogControl/genius').set({ enabled: true, seedComplete: true });
});
after(() => db.terminate());
test('deduplicated priority promotion, overlapping workers and repeated delivery preserve all producer counts', async () => {
  await enqueueGenius('t', 0);
  await enqueueGenius('t', 10);
  assert.equal((await db.doc('_catalogJobs/t').get()).data()!.priority, 10);
  await Promise.all([runGeniusJobs(request), runGeniusJobs(request)]);
  await enqueueGenius('t', 10);
  await runGeniusJobs(request);
  const track = (await db.doc('tracks/t').get()).data()!;
  assert.equal(track.ratingCount, 3);
  assert.equal(track.saveCount, 2);
  assert.equal(track.producerIds.length, 2);
  for (const producer of (await db.collection('producers').get()).docs)
    assert.equal(producer.data().trackCount, 1);
  assert.equal((await db.doc('_catalogJobs/t').get()).data()!.status, 'matched');
});
test('outages retain deferred tracks and retry state; Retry-After pauses the shared worker', async () => {
  await enqueueGenius('t', 10);
  const before = (await db.doc('tracks/t').get()).data();
  await runGeniusJobs(async () => {
    throw new GeniusRequestError(429, '3600');
  });
  const job = (await db.doc('_catalogJobs/t').get()).data()!;
  assert.equal(job.status, 'pending');
  assert.ok(job.dueAt > Date.now() + 3500000);
  assert.deepEqual((await db.doc('tracks/t').get()).data(), before);
  assert.equal((await runGeniusJobs(request)).processed, 0);
});
test('ambiguous results are distinct from no match and do not invent producer credits', async () => {
  await enqueueGenius('t', 10);
  await runGeniusJobs(async () => ({
    response: { hits: [{ result: song }, { result: { ...song, id: 2 } }] },
  }));
  assert.equal((await db.doc('_catalogJobs/t').get()).data()!.status, 'ambiguous');
  assert.equal((await db.doc('tracks/t').get()).data()!.geniusStatus, 'ambiguous');
  assert.equal((await db.collection('producers').get()).size, 0);
});
test('expired worker leases resume and repeated crashes stop after six attempts', async () => {
  await enqueueGenius('t', 0);
  await db.doc('_catalogJobs/t').update({ status: 'processing', attempts: 6, dueAt: 0 });
  await runGeniusJobs(request);
  const job = (await db.doc('_catalogJobs/t').get()).data()!;
  assert.equal(job.status, 'dead');
  assert.equal(job.dueAt, undefined);
  assert.equal(retryTime(30, 0, 0), 86400000);
});
test('disabled queue makes no provider requests', async () => {
  await db.doc('_catalogControl/genius').update({ enabled: false });
  await enqueueGenius('t', 10);
  assert.equal(
    (
      await runGeniusJobs(async () => {
        throw new Error('must not call');
      })
    ).processed,
    0,
  );
});
