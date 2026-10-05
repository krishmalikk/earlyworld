import { SoundCloudError, soundCloudProfileUrl } from '../functions/src/soundcloud-api';

const origin = 'https://api.soundcloud.com';
/** Only public metadata endpoints; validate pagination and redirects before attaching OAuth. */
export function metadataUrl(value: string, expectedPath?: string) {
  const url = new URL(value, origin);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    url.hash ||
    !/^\/(?:resolve|users|users\/(?:[0-9]+|soundcloud(?::|%3A)users(?::|%3A)[0-9]+)(?:\/tracks)?)$/i.test(
      url.pathname,
    ) ||
    (expectedPath && url.pathname !== expectedPath)
  )
    throw new Error('Unsafe SoundCloud metadata URL.');
  // Pagination must use the server token, never credentials embedded in a URL.
  for (const key of ['client_id', 'client_secret', 'oauth_token', 'access_token'])
    url.searchParams.delete(key);
  return url;
}
export async function publicMetadata(
  value: string,
  getToken: (rejected?: string) => Promise<string>,
  request: typeof fetch = fetch,
) {
  let url = metadataUrl(value),
    token = await getToken();
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await request(url, {
      headers: { Authorization: `OAuth ${token}`, Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      url = metadataUrl(new URL(response.headers.get('location') || '', url).href);
      continue;
    }
    if (response.status === 401 && attempt === 0) {
      token = await getToken(token);
      continue;
    }
    // Stop on 429. Rerun the checkpoint later; never circumvent provider limits.
    if (!response.ok) throw new SoundCloudError(response.status);
    return response.json() as Promise<any>;
  }
  throw new SoundCloudError(502, 'Too many SoundCloud redirects.');
}
export function publicArtist(raw: any) {
  const urn = raw?.urn || (Number.isSafeInteger(raw?.id) ? `soundcloud:users:${raw.id}` : '');
  const profileUrl = soundCloudProfileUrl(raw?.permalink_url);
  if (
    raw?.kind !== 'user' ||
    !/^soundcloud:users:[0-9]+$/.test(urn) ||
    !profileUrl ||
    !raw.username?.trim()
  )
    throw new Error('Invalid public SoundCloud artist.');
  return {
    urn: urn as string,
    name: String(raw.username).trim(),
    profileUrl,
    avatarUrl:
      typeof raw.avatar_url === 'string' && raw.avatar_url.startsWith('https://')
        ? raw.avatar_url
        : '',
    reportedTracks: Number(raw.track_count) || 0,
  };
}
