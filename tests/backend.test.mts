import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
process.env.GCLOUD_PROJECT = 'demo-earlyworld';
if (!process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error('Run inside the demo Firestore emulator.');
const { db, Timestamp } = await import('../functions/src/core.ts');
const { onSave } = await import('../functions/src/saves.ts');
const { engagementInTransaction } = await import('../functions/src/engagement.ts');
const { computeMatchesFor } = await import('../functions/src/matching.ts');
const { computeRotationFor } = await import('../functions/src/rotation.ts');
const track = {
  artistId: 'artist_a',
  artistName: 'Artist',
  producerId: 'producer_p',
  producerName: 'Producer',
  title: 'A',
  saveCount: 0,
  savers: [],
  saversCapped: false,
};
beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-earlyworld/databases/(default)/documents`,
    { method: 'DELETE' },
  );
});
after(async () => {
  await db.terminate();
});
const event = (uid: string, trackId = 't') =>
  ({ id: Math.random().toString(), params: { uid, trackId } }) as any;
async function user(uid: string, complete = false) {
  await db
    .doc(`users/${uid}`)
    .set({ saveCount: 0, onboardingComplete: complete, totalSaveEvents: 0 });
}
async function save(uid: string) {
  await db.doc(`users/${uid}/saves/t`).set({ savedAt: Timestamp.now() });
}
test('real save trigger enforces 200 cap with retries, deletes, and re-saves', async () => {
  await db
    .doc('tracks/t')
    .set({ ...track, saveCount: 199, savers: Array.from({ length: 199 }, (_, i) => `old${i}`) });
  await user('a');
  await user('b');
  await save('a');
  await onSave.run(event('a'));
  await onSave.run(event('a'));
  let t = (await db.doc('tracks/t').get()).data()!;
  assert.equal(t.saveCount, 200);
  assert.equal(t.savers.length, 200);
  assert.equal(t.saversCapped, false);
  await save('b');
  await onSave.run(event('b'));
  t = (await db.doc('tracks/t').get()).data()!;
  assert.equal(t.saveCount, 201);
  assert.equal(t.savers.length, 200);
  assert.equal(t.saversCapped, true);
  await db.doc('users/a/saves/t').delete();
  await onSave.run(event('a'));
  await onSave.run(event('a'));
  t = (await db.doc('tracks/t').get()).data()!;
  assert.equal(t.saveCount, 200);
  assert.equal(t.saversCapped, true);
  await save('a');
  await onSave.run(event('a'));
  t = (await db.doc('tracks/t').get()).data()!;
  assert.equal(t.saveCount, 201);
  assert.equal(t.savers.length, 199);
  assert.equal(t.saversCapped, true);
});
test('out-of-order save/delete deliveries reconcile current document and cannot make counts negative', async () => {
  await db.doc('tracks/t').set(track);
  await user('a');
  await onSave.run(event('a'));
  assert.equal((await db.doc('tracks/t').get()).data()!.saveCount, 0);
  await save('a');
  await onSave.run(event('a'));
  await onSave.run(event('a'));
  assert.equal((await db.doc('users/a').get()).data()!.saveCount, 1);
});
test('comments cap at five per entity per day, retries do not count, producer earns independently', async () => {
  await user('a', true);
  const now = new Date('2026-09-22T12:00:00Z');
  for (let i = 0; i < 7; i++)
    await db.runTransaction((tx) =>
      engagementInTransaction(tx, 'a', `t${i}`, track, 'comment', `event${i}`, now),
    );
  await db.runTransaction((tx) =>
    engagementInTransaction(tx, 'a', 't0', track, 'comment', 'event0', now),
  );
  for (const id of ['artist_a', 'producer_p']) {
    const stats = (await db.doc(`users/a/engagementStats/${id}`).get()).data()!;
    assert.equal(stats.commentCount, 5);
    assert.equal(stats.trackIds.length, 5);
    assert.equal(stats.weekKeys.length, 1);
  }
});
test('delayed onboarding saves do not grant engagement or Rotation', async () => {
  await user('a', true);
  await db.doc('users/a').update({ onboardingCompletedAt: Timestamp.fromMillis(10000) });
  await db.runTransaction((tx) =>
    engagementInTransaction(tx, 'a', 't', track, 'save', 'old-save', new Date(9000)),
  );
  assert.equal((await db.collection('users/a/engagementStats').get()).size, 0);
});
test('matching writes top rare overlap and deletes stale results', async () => {
  await user('a');
  await db.doc('users/a/saves/t').set({});
  await db.doc('tracks/t').set({ ...track, saveCount: 2, savers: ['a', 'b'] });
  await db.doc('users/a/matches/stale').set({ score: 100 });
  await computeMatchesFor('a');
  const matches = await db.collection('users/a/matches').get();
  assert.equal(matches.size, 1);
  assert.equal(matches.docs[0].id, 'b');
  assert.equal(matches.docs[0].data().sharedTracks[0].saveCount, 2);
});
test('nightly Rotation creates independently earned artist and producer certifications', async () => {
  await user('a', true);
  await db.doc('tracks/t').set({ ...track, saveCount: 2 });
  await db.doc('artists/artist_a').set({ name: 'Artist', imageUrl: '' });
  await db.doc('producers/producer_p').set({ name: 'Producer', imageUrl: '' });
  const now = new Date('2026-09-22T12:00:00Z');
  for (const [event, at] of [
    ['first', new Date('2026-09-08T12:00:00Z')],
    ['second', now],
  ] as const)
    await db.runTransaction((tx) =>
      engagementInTransaction(tx, 'a', 't', track, 'save', event, at),
    );
  await computeRotationFor('a', now);
  const rows = await db.collection('users/a/rotation').get();
  assert.equal(rows.size, 2);
  for (const row of rows.docs) {
    assert.equal(row.data().distinctWeeks, 2);
    assert.equal(row.data().distinctTracks, 1);
    assert.equal(row.data().tier, 'gold');
    assert.equal(row.data().entityId, row.id);
  }
});
test('seed script inserts all records once and preserves existing counters and credits', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  await run(process.execPath, ['--import', 'tsx', 'scripts/seed.ts'], { env: process.env });
  const tracks = await db.collection('tracks').get();
  assert.equal(tracks.size, 200);
  assert.equal((await db.collection('artists').get()).size, 40);
  assert.ok((await db.collection('producers').get()).size >= 18);
  const ref = tracks.docs[0].ref;
  await ref.update({
    saveCount: 27,
    geniusStatus: 'matched',
    credits: { producers: ['Verified'] },
  });
  await run(process.execPath, ['--import', 'tsx', 'scripts/seed.ts'], { env: process.env });
  assert.equal((await db.collection('tracks').get()).size, 200);
  const preserved = (await ref.get()).data()!;
  assert.equal(preserved.saveCount, 27);
  assert.equal(preserved.geniusStatus, 'matched');
  assert.deepEqual(preserved.credits.producers, ['Verified']);
});
