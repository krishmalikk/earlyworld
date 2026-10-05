import test from 'node:test';
import assert from 'node:assert/strict';
import {
  soundCloudMetadata,
  fetchSoundCloudMetadata,
  SoundCloudError,
} from '../functions/src/soundcloud-api';
import { scTrack } from './soundcloud.fixture';

test('SoundCloud keeps metadata only, canonicalizes URLs, and rejects private/non-track responses', () => {
  const value = soundCloudMetadata(scTrack);
  assert.equal(value.urn, 'soundcloud:tracks:123');
  assert.equal(value.permalinkUrl, 'https://soundcloud.com/artist/new-slug');
  assert.equal(value.durationSeconds, 126);
  assert.equal(value.artistName, 'Artist');
  assert.doesNotMatch(JSON.stringify(value), /stream_url|download_url|playback_count|description/);
  for (const raw of [
    { ...scTrack, sharing: 'private' },
    { ...scTrack, kind: 'playlist' },
    { ...scTrack, permalink_url: 'https://evil.example/a/b' },
    { ...scTrack, id: Number.MAX_SAFE_INTEGER + 1, urn: undefined },
  ])
    assert.throws(() => soundCloudMetadata(raw));
});
test('SoundCloud follows metadata redirects and refreshes a rejected token once', async () => {
  const requests: string[] = [],
    rejected: (string | undefined)[] = [];
  const request = (async (url: any, options: any) => {
    requests.push(String(url));
    if (options.headers.Authorization === 'OAuth expired') return new Response('', { status: 401 });
    if (String(url).includes('/resolve?'))
      return new Response('', {
        status: 302,
        headers: { location: 'https://api.soundcloud.com/tracks/123' },
      });
    return Response.json(scTrack);
  }) as typeof fetch;
  const result = await fetchSoundCloudMetadata(
    'https://soundcloud.com/artist/old',
    undefined,
    async (token) => {
      rejected.push(token);
      return token ? 'fresh' : 'expired';
    },
    request,
  );
  assert.equal(result.urn, 'soundcloud:tracks:123');
  assert.deepEqual(rejected, [undefined, 'expired']);
  assert.equal(requests.length, 3);
});
test('SoundCloud does not forward tokens to external hosts or fetch streams', async () => {
  for (const location of [
    'https://evil.example/collect',
    'https://api.soundcloud.com/tracks/123/streams',
  ]) {
    let requests = 0;
    const request = (async () => {
      requests++;
      return new Response('', { status: 302, headers: { location } });
    }) as typeof fetch;
    await assert.rejects(
      fetchSoundCloudMetadata(
        'https://soundcloud.com/a/b',
        undefined,
        async () => 'token',
        request,
      ),
      /Unexpected SoundCloud redirect/,
    );
    assert.equal(requests, 1);
  }
});
test('SoundCloud stable URNs survive renamed URLs; rate limits are surfaced without retries', async () => {
  let requested = '';
  const request = (async (url: any) => {
    requested = String(url);
    return Response.json(scTrack);
  }) as typeof fetch;
  await fetchSoundCloudMetadata(
    'https://soundcloud.com/artist/old',
    'soundcloud:tracks:123',
    async () => 'token',
    request,
  );
  assert.equal(requested, 'https://api.soundcloud.com/tracks/soundcloud%3Atracks%3A123');
  await assert.rejects(
    fetchSoundCloudMetadata(
      'https://soundcloud.com/a/b',
      undefined,
      async () => 'token',
      (async () => new Response('', { status: 429 })) as typeof fetch,
    ),
    (e) => e instanceof SoundCloudError && e.status === 429,
  );
});
