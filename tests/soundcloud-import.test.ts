import test from 'node:test';
import assert from 'node:assert/strict';
import { metadataUrl, publicArtist, publicMetadata } from '../scripts/soundcloud-client';

test('import pagination refuses external/media endpoints before sending OAuth', async () => {
  for (const url of [
    'https://evil.example/users/123/tracks',
    'https://api.soundcloud.com.evil.example/users',
    'https://name:password@api.soundcloud.com/users',
    '/tracks/123/stream',
    '/users/123/likes',
  ])
    assert.throws(() => metadataUrl(url));
  assert.throws(() => metadataUrl('/users/124/tracks', '/users/123/tracks'));
  assert.equal(
    metadataUrl('/users/123/tracks?access_token=secret&cursor=x', '/users/123/tracks').search,
    '?cursor=x',
  );
  let requests = 0;
  await assert.rejects(
    publicMetadata('/users/123', async () => 'test-token', (async () => {
      requests++;
      return new Response(null, {
        status: 302,
        headers: { location: 'https://evil.example/users/123' },
      });
    }) as typeof fetch),
  );
  assert.equal(requests, 1);
});
test('import client stops on rate limits and refreshes a rejected token once', async () => {
  let requests = 0;
  await assert.rejects(
    publicMetadata('/users/123', async () => 'test-token', (async () => {
      requests++;
      return new Response(null, { status: 429 });
    }) as typeof fetch),
    { status: 429 },
  );
  assert.equal(requests, 1);
  const rejected: (string | undefined)[] = [];
  requests = 0;
  await publicMetadata(
    '/users/123',
    async (token) => {
      rejected.push(token);
      return token ? 'new' : 'old';
    },
    (async () =>
      ++requests === 1
        ? new Response(null, { status: 401 })
        : Response.json({ kind: 'user' })) as typeof fetch,
  );
  assert.deepEqual(rejected, [undefined, 'old']);
});
test('reviewed artist metadata rejects non-user payloads and unsafe identities', () => {
  assert.throws(() => publicArtist({ kind: 'track' }));
  assert.throws(() =>
    publicArtist({
      kind: 'user',
      urn: 'bad',
      username: 'Name',
      permalink_url: 'https://soundcloud.com/name',
    }),
  );
});
