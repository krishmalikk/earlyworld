import { beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { scTrack } from './soundcloud.fixture.ts';
import { soundCloudMetadata } from '../functions/src/soundcloud-api.ts';
process.env.GCLOUD_PROJECT = 'demo-earlyworld-soundcloud-tests';
process.env.SOUNDCLOUD_CLIENT_ID = 'test-client';
process.env.SOUNDCLOUD_CLIENT_SECRET = 'test-secret';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Use an isolated Firestore emulator.');
const { db, Timestamp } = await import('../functions/src/core.ts');
const {
  reconcileSoundCloudTrack,
  soundCloudIdentityRef,
  soundCloudToken,
  adminSyncSoundCloud,
  syncSoundCloudPage,
} = await import('../functions/src/soundcloud.ts');
const { addTrack } = await import('../functions/src/catalog.ts');
const { importArtistPage, eligibleUpload } = await import('../scripts/soundcloud-importer.ts');
const originalFetch = globalThis.fetch;
beforeEach(async () => {
  await originalFetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-earlyworld-soundcloud-tests/databases/(default)/documents`,
    { method: 'DELETE' },
  );
});
after(async () => {
  globalThis.fetch = originalFetch;
  await db.terminate();
});
async function seed() {
  await db.doc('artists/curated').set({
    name: 'Editorial Artist',
    sourceUrl: 'https://soundcloud.com/artist',
    imageUrl: 'old',
    trackCount: 5,
    scenes: ['plugg'],
  });
  await db.doc('tracks/original').set({
    sourcePlatform: 'soundcloud',
    sourceUrl: 'https://soundcloud.com/artist/old',
    title: 'Old title',
    artistId: 'curated',
    artistName: 'Editorial Artist',
    producerId: 'p',
    credits: { producers: ['P'] },
    saveCount: 3,
    savers: ['a'],
    ratingCount: 2,
    ratingHalfStarSum: 17,
    createdAt: Timestamp.fromMillis(1000),
  });
}
const importArtist = {
  urn: scTrack.user.urn,
  name: 'Reviewed artist',
  profileUrl: scTrack.user.permalink_url,
  avatarUrl: scTrack.user.avatar_url,
  scenes: ['plugg'],
};
test('bulk import filters private, wrong-uploader, leaked, short, and mix uploads', () => {
  assert.ok(eligibleUpload(scTrack, importArtist.urn));
  for (const raw of [
    { ...scTrack, sharing: 'private' },
    { ...scTrack, title: 'Song [snippet]' },
    { ...scTrack, title: 'Unreleased song' },
    { ...scTrack, duration: 20000 },
    { ...scTrack, duration: 3600000 },
    { ...scTrack, created_at: 'invalid' },
  ])
    assert.equal(eligibleUpload(raw, importArtist.urn), null);
  assert.equal(eligibleUpload(scTrack, 'soundcloud:users:99'), null);
});
test('bulk import retries and concurrent submissions create one track and one artist count', async () => {
  const t = soundCloudMetadata(scTrack);
  const results = await Promise.all([
    importArtistPage(importArtist, [t, t], 100),
    importArtistPage(importArtist, [t], 100),
  ]);
  assert.equal(
    results.reduce((n, r) => n + r.added, 0),
    1,
  );
  assert.equal((await db.collection('tracks').get()).size, 1);
  const artist = (await db.collection('artists').get()).docs[0].data();
  assert.equal(artist.trackCount, 1);
  const doc = (await db.collection('tracks').get()).docs[0];
  assert.equal(doc.data().geniusStatus, 'deferred');
  await doc.ref.update({
    saveCount: 3,
    ratingCount: 1,
    ratingHalfStarSum: 8,
    credits: { producers: ['Keep'] },
  });
  assert.equal((await importArtistPage(importArtist, [t], 100)).added, 0);
  assert.equal((await doc.ref.get()).data()!.saveCount, 3);
  assert.deepEqual((await doc.ref.get()).data()!.credits, { producers: ['Keep'] });
});
test('bulk import respects remaining capacity and rejects artist identity conflicts atomically', async () => {
  const a = soundCloudMetadata(scTrack),
    b = {
      ...a,
      urn: 'soundcloud:tracks:124',
      permalinkUrl: 'https://soundcloud.com/artist/second',
    };
  assert.equal((await importArtistPage(importArtist, [a, b], 1)).added, 1);
  const artistDoc = (await db.collection('artists').get()).docs[0];
  await artistDoc.ref.update({ soundcloud: { urn: 'soundcloud:users:999' } });
  await assert.rejects(importArtistPage({ ...importArtist, existingId: artistDoc.id }, [b], 100));
  assert.equal((await db.collection('tracks').get()).size, 1);
  assert.equal((await artistDoc.ref.get()).data()!.trackCount, 1);
});
function mockApi(status = 200) {
  globalThis.fetch = (async (url: any) =>
    String(url).includes('secure.soundcloud.com')
      ? Response.json({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: 3600,
        })
      : status === 200
        ? Response.json(scTrack)
        : new Response('', { status })) as typeof fetch;
}
test('SoundCloud refresh preserves document/social identity and updates only matching artist metadata', async () => {
  await seed();
  const value = soundCloudMetadata(scTrack);
  await reconcileSoundCloudTrack('original', value);
  await reconcileSoundCloudTrack('original', value);
  const track = (await db.doc('tracks/original').get()).data()!;
  assert.equal(track.title, 'New title');
  assert.equal(track.artistName, 'Editorial Artist');
  assert.equal(track.artistId, 'curated');
  assert.equal(track.saveCount, 3);
  assert.equal(track.ratingCount, 2);
  assert.equal(track.ratingHalfStarSum, 17);
  assert.deepEqual(track.credits, { producers: ['P'] });
  assert.equal(track.createdAt.toMillis(), 1000);
  const artist = (await db.doc('artists/curated').get()).data()!;
  assert.equal(artist.trackCount, 5);
  assert.equal(artist.name, 'Editorial Artist');
  assert.equal(artist.imageUrl, scTrack.user.avatar_url);
  assert.equal((await soundCloudIdentityRef(value.urn).get()).data()!.trackId, 'original');
  await db
    .doc('artists/other')
    .set({ sourceUrl: 'https://soundcloud.com/other', imageUrl: 'keep' });
  await db.doc('tracks/original').update({ artistId: 'other' });
  await reconcileSoundCloudTrack('original', value);
  assert.equal((await db.doc('artists/other').get()).data()!.imageUrl, 'keep');
});
test('SoundCloud identity collisions fail and renamed-link adds return the original track', async () => {
  await seed();
  const value = soundCloudMetadata(scTrack);
  await reconcileSoundCloudTrack('original', value);
  await db.doc('tracks/duplicate').set({ sourcePlatform: 'soundcloud', artistId: 'curated' });
  await assert.rejects(reconcileSoundCloudTrack('duplicate', value));
  mockApi();
  try {
    const result = await addTrack.run({
      auth: { uid: 'a' },
      data: {
        sourceUrl: value.permalinkUrl,
        title: 'New title',
        artistName: 'Artist',
        publicReleaseConfirmed: true,
      },
    } as any);
    assert.deepEqual(result, { trackId: 'original', existing: true });
    assert.equal((await db.doc('artists/curated').get()).data()!.trackCount, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('SoundCloud token cache serializes concurrent refreshes and reuses unexpired tokens', async () => {
  let calls = 0;
  const grants: string[] = [];
  globalThis.fetch = (async (_url: any, options: any) => {
    calls++;
    grants.push(options.body.get('grant_type'));
    return Response.json({
      access_token: `token-${calls}`,
      refresh_token: `refresh-${calls}`,
      expires_in: 3600,
    });
  }) as typeof fetch;
  try {
    const tokens = await Promise.all([soundCloudToken(), soundCloudToken(), soundCloudToken()]);
    assert.deepEqual(tokens, ['token-1', 'token-1', 'token-1']);
    assert.equal(calls, 1);
    assert.equal(await soundCloudToken('token-1'), 'token-2');
    assert.deepEqual(grants, ['client_credentials', 'refresh_token']);
    assert.equal(await soundCloudToken('token-1'), 'token-2');
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('SoundCloud sync supports dry runs, missing releases, recovery, and leaves outages unchanged', async () => {
  await seed();
  mockApi();
  try {
    const dry = await syncSoundCloudPage(undefined, false);
    assert.equal(dry.refreshed, 1);
    assert.equal((await db.doc('tracks/original').get()).data()!.title, 'Old title');
    mockApi(404);
    const missing = await syncSoundCloudPage(undefined, true);
    assert.equal(missing.unavailable, 1);
    assert.equal((await db.doc('tracks/original').get()).data()!.sourceStatus, 'unavailable');
    mockApi();
    await syncSoundCloudPage(undefined, true);
    const good = (await db.doc('tracks/original').get()).data()!;
    assert.equal(good.sourceStatus, 'available');
    mockApi(429);
    await assert.rejects(syncSoundCloudPage(undefined, true));
    const after = (await db.doc('tracks/original').get()).data()!;
    assert.ok(after.sourceCheckedAt.isEqual(good.sourceCheckedAt));
    assert.equal(after.ratingCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('SoundCloud bulk sync is admin-only', async () => {
  for (const auth of [undefined, { uid: 'user', token: {} }])
    await assert.rejects(adminSyncSoundCloud.run({ auth, data: {} } as any), /Admin only/);
});

test('provider snapshots exclude community data and explicit editorial overrides survive refresh', async () => {
  await seed();
  await db.doc('tracks/original').update({ editorial: { title: 'Corrected title' } });
  await reconcileSoundCloudTrack('original', soundCloudMetadata(scTrack));
  const track = (await db.doc('tracks/original').get()).data()!;
  assert.equal(track.title, 'Corrected title');
  assert.equal(track.saveCount, 3);
  const source = (await db.doc('_providerMetadata/original/sources/soundcloud').get()).data()!;
  assert.equal(source.metadata.title, scTrack.title);
  assert.equal(source.saveCount, undefined);
  assert.equal(source.ratingCount, undefined);
});
test('authorization failure cannot mark catalog tracks as removed', async () => {
  await seed();
  mockApi(403);
  try {
    await assert.rejects(syncSoundCloudPage(undefined, true));
    assert.equal((await db.doc('tracks/original').get()).data()!.sourceStatus, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
