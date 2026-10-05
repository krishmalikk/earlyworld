import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.GCLOUD_PROJECT = 'demo-earlyworld-release-import';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Use isolated emulator.');
const { db, hash } = await import('../functions/src/core.ts');
const { releaseMetadata, releaseMetadataUrl, releaseRequest, storeRelease, syncArtistReleasePage } =
  await import('../functions/src/releases.ts');
const artist = { name: 'Artist', soundcloud: { urn: 'soundcloud:users:1' } };
const playlist = {
  id: 10,
  urn: 'soundcloud:playlists:10',
  title: 'Album',
  kind: 'playlist',
  playlist_type: 'album',
  sharing: 'public',
  user: { id: 1 },
  track_count: 2,
  permalink_url: 'https://soundcloud.com/artist/sets/album',
  artwork_url: 'https://i1.sndcdn.com/artworks-a-large.jpg',
  release_year: 2024,
};
const track = (id: number) => ({
  kind: 'track',
  id,
  sharing: 'public',
  title: `Song ${id}`,
  duration: 90000,
  created_at: '2024-01-01',
  permalink_url: `https://soundcloud.com/artist/song-${id}`,
  user: { id: 1, username: 'Artist', permalink_url: 'https://soundcloud.com/artist' },
});
beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-earlyworld-release-import/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await db.doc('artists/a').set(artist);
});
after(() => db.terminate());
test('only explicitly classified public releases owned by the existing artist qualify', () => {
  assert.equal(releaseMetadata(playlist, artist.soundcloud.urn)?.releaseType, 'album');
  for (const type of ['EP', 'mixtape', 'compilation', 'single'])
    assert.ok(releaseMetadata({ ...playlist, playlist_type: type }, artist.soundcloud.urn));
  for (const data of [
    { playlist_type: 'PLAYLIST' },
    { playlist_type: '' },
    { sharing: 'private' },
    { user: { id: 2 } },
    { permalink_url: 'https://evil.example/artist/sets/album' },
  ])
    assert.equal(releaseMetadata({ ...playlist, ...data }, artist.soundcloud.urn), null);
});
test('metadata access rejects external URLs, streams, redirects and stops on provider limits', async () => {
  for (const url of [
    'https://evil.example/users/1/playlists',
    '/tracks/1/stream',
    '/tracks/1/download',
    'https://api.soundcloud.com@evil.example/playlists/1',
  ])
    assert.throws(() => releaseMetadataUrl(url));
  assert.throws(() => releaseMetadataUrl('/users/2/playlists', '/users/1/playlists'));
  let calls = 0;
  await assert.rejects(
    releaseRequest(
      '/playlists/10',
      async () => 'fake-token',
      async (_url, options) => {
        calls++;
        assert.equal(options?.redirect, 'error');
        return new Response('', { status: 429 });
      },
    ),
    { status: 429 },
  );
  assert.equal(calls, 1);
});
test('ordered tracklist links stable catalog IDs and repeated imports preserve all opinions', async () => {
  await db.doc('tracks/existing').set({ title: 'Existing', ratingCount: 3, saveCount: 8 });
  await db.doc(`_soundcloudTracks/${hash('soundcloud:tracks:2')}`).set({ trackId: 'existing' });
  await storeRelease('a', artist, playlist, [track(2), track(1)]);
  const ref = db.doc(`releases/${hash(playlist.urn)}`);
  const data = (await ref.get()).data()!;
  assert.deepEqual(
    data.tracks.map((t: any) => [t.title, t.trackId]),
    [
      ['Song 2', 'existing'],
      ['Song 1', null],
    ],
  );
  assert.equal(data.releasedAt, '2024');
  await ref.update({ ratingCount: 2, ratingHalfStarSum: 17 });
  await storeRelease('a', artist, { ...playlist, title: 'Updated title' }, [track(2), track(1)]);
  assert.equal((await ref.get()).data()!.ratingHalfStarSum, 17);
  assert.equal((await db.doc('tracks/existing').get()).data()!.saveCount, 8);
  assert.equal((await db.collection('releases').get()).size, 1);
  await assert.rejects(storeRelease('a', artist, playlist, [track(1)]));
  await assert.rejects(
    storeRelease('a', artist, playlist, [track(1), { ...track(2), sharing: 'private' }]),
  );
});
test('paged artist sync resumes, verifies track order, and completed requests are no-ops', async () => {
  const requests: string[] = [];
  const request = async (url: string) => {
    requests.push(url);
    if (url.includes('/users/')) return { collection: [playlist], next_href: null };
    if (url.includes('/tracks')) return { collection: [track(2), track(1)], next_href: null };
    return playlist;
  };
  assert.deepEqual(await syncArtistReleasePage('a', request), {
    imported: 1,
    skipped: 0,
    complete: true,
  });
  assert.deepEqual(await syncArtistReleasePage('a', request), { imported: 0, complete: true });
  assert.equal(requests.length, 3);
  assert.equal((await db.doc('_releaseSync/a').get()).exists, false);
});
test('failed sync keeps its checkpoint and releases the lease for a retry', async () => {
  await assert.rejects(
    syncArtistReleasePage('a', async () => {
      throw Error('provider outage');
    }),
  );
  assert.equal((await db.doc('artists/a').get()).data()!.releaseSync, undefined);
  assert.equal((await db.doc('_releaseSync/a').get()).exists, false);
  await db.doc('_releaseSync/a').set({ lease: 'another', until: Date.now() + 50000 });
  await assert.rejects(
    syncArtistReleasePage('a', async () => {
      throw Error('must not fetch');
    }),
    { code: 'resource-exhausted' },
  );
});

test('catalog backfill visits only existing verified artists and preserves progress after a failed page', async () => {
  const { syncReleaseCatalogPage } = await import('../functions/src/releases.ts');
  await db.doc('artists/b').set({ name: 'B', soundcloud: { urn: 'soundcloud:users:2' } });
  await db.doc('artists/unverified').set({ name: 'C' });
  const visited: string[] = [];
  await assert.rejects(
    syncReleaseCatalogPage(async (id) => {
      visited.push(id);
      if (id === 'b') throw Error('outage');
      await db.doc(`artists/${id}`).update({ releaseSync: { complete: true, version: 2 } });
      return { imported: 1, skipped: 0, complete: true };
    }),
  );
  assert.deepEqual(visited, ['a', 'b']);
  assert.equal((await db.doc('_integrations/releaseCatalog').get()).data()!.afterArtist, 'a');
  assert.equal((await db.doc('_integrations/releaseCatalog').get()).data()!.lease, undefined);
  const retry = await syncReleaseCatalogPage(async (id) => {
    assert.equal(id, 'b');
    return { imported: 2, complete: true };
  });
  assert.equal(retry.complete, true);
  assert.equal(retry.imported, 2);
  assert.equal((await db.collection('artists').get()).size, 3);
});

test('provider tracking parameters are removed from public release links', () => {
  const data = releaseMetadata(
    {
      ...playlist,
      permalink_url: playlist.permalink_url + '?utm_medium=api&utm_campaign=social_sharing#artwork',
    },
    artist.soundcloud.urn,
  );
  assert.equal(data?.sourceUrl, playlist.permalink_url);
});

test('unavailable tracklists are skipped without publishing empty releases or blocking later artists', async () => {
  const result = await syncArtistReleasePage('a', async (url) => {
    if (url.includes('/users/')) return { collection: [playlist], next_href: null };
    if (url.includes('/tracks')) return { collection: [], next_href: null };
    return playlist;
  });
  assert.equal(result.complete, true);
  assert.equal(result.imported, 0);
  assert.equal('skipped' in result && result.skipped, 1);
  assert.equal((await db.collection('releases').get()).size, 0);
  assert.equal((await db.doc('artists/a').get()).data()!.releaseSync.skippedReleases, 1);
});
