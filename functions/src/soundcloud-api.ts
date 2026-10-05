import { normalizeSource } from '../../shared/domain';

export class SoundCloudError extends Error {
  constructor(
    public status: number,
    message = `SoundCloud request failed (${status}).`,
  ) {
    super(message);
  }
}
export type SoundCloudMetadata = {
  urn: string;
  title: string;
  artworkUrl: string;
  permalinkUrl: string;
  durationSeconds: number;
  publishedAt: string | null;
  genre: string;
  artistName: string;
  uploader: { urn: string; name: string; profileUrl: string; avatarUrl: string };
};
const text = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
function urn(value: unknown, id: unknown, kind: 'tracks' | 'users') {
  if (typeof value === 'string' && new RegExp(`^soundcloud:${kind}:[0-9]+$`).test(value))
    return value;
  if (
    (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) ||
    (typeof id === 'string' && /^[0-9]+$/.test(id))
  )
    return `soundcloud:${kind}:${id}`;
  throw new SoundCloudError(502, 'SoundCloud returned an invalid identity.');
}
function imageUrl(value: unknown) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}
export function soundCloudProfileUrl(value: unknown) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' &&
      ['soundcloud.com', 'www.soundcloud.com'].includes(u.hostname) &&
      !u.username &&
      !u.password &&
      /^\/[^/]+\/?$/.test(u.pathname)
      ? `https://soundcloud.com${u.pathname.replace(/\/$/, '')}`
      : '';
  } catch {
    return '';
  }
}
/** Keep metadata only: no audio URLs, descriptions, private fields, or platform engagement counts. */
export function soundCloudMetadata(raw: any): SoundCloudMetadata {
  if (raw?.kind !== 'track' || raw.sharing !== 'public')
    throw new SoundCloudError(404, 'This public SoundCloud track is unavailable.');
  const title = text(raw.title, 200);
  const source = normalizeSource(raw.permalink_url);
  if (!title || source.platform !== 'soundcloud' || !raw.user)
    throw new SoundCloudError(502, 'Incomplete SoundCloud metadata.');
  const duration = Number(raw.duration);
  const date = Date.parse(raw.created_at);
  return {
    urn: urn(raw.urn, raw.id, 'tracks'),
    title,
    artworkUrl: imageUrl(raw.artwork_url) || imageUrl(raw.user.avatar_url),
    permalinkUrl: source.url,
    durationSeconds: Number.isFinite(duration) && duration >= 0 ? Math.round(duration / 1000) : 0,
    publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : null,
    genre: text(raw.genre, 100),
    artistName: text(raw.metadata_artist, 100) || text(raw.user.username, 100),
    uploader: {
      urn: urn(raw.user.urn, raw.user.id, 'users'),
      name: text(raw.user.username, 100),
      profileUrl: soundCloudProfileUrl(raw.user.permalink_url),
      avatarUrl: imageUrl(raw.user.avatar_url),
    },
  };
}
export async function fetchSoundCloudMetadata(
  sourceUrl: string,
  existingUrn: string | undefined,
  getToken: (rejected?: string) => Promise<string>,
  request: typeof fetch = fetch,
): Promise<SoundCloudMetadata> {
  const source = normalizeSource(sourceUrl);
  if (source.platform !== 'soundcloud')
    throw new SoundCloudError(400, 'Use a public SoundCloud track URL.');
  const path =
    existingUrn && /^soundcloud:tracks:[0-9]+$/.test(existingUrn)
      ? `/tracks/${encodeURIComponent(existingUrn)}`
      : `/resolve?url=${encodeURIComponent(source.url)}`;
  let token = await getToken();
  for (let attempt = 0; attempt < 2; attempt++) {
    let url = new URL(path, 'https://api.soundcloud.com');
    let response: Response | undefined;
    // Resolve may redirect. Never forward the token to another origin or to a media endpoint.
    for (let redirects = 0; redirects < 4; redirects++) {
      response = await request(url, {
        headers: { Authorization: `OAuth ${token}`, Accept: 'application/json' },
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      if (!location) throw new SoundCloudError(502, 'Invalid SoundCloud redirect.');
      url = new URL(location, url);
      if (
        url.origin !== 'https://api.soundcloud.com' ||
        !/^\/tracks\/(?:[0-9]+|soundcloud(?::|%3A)tracks(?::|%3A)[0-9]+)$/i.test(url.pathname)
      )
        throw new SoundCloudError(502, 'Unexpected SoundCloud redirect.');
    }
    if (response?.status === 401 && attempt === 0) {
      token = await getToken(token);
      continue;
    }
    if (!response?.ok) throw new SoundCloudError(response?.status || 502);
    return soundCloudMetadata(await response.json());
  }
  throw new SoundCloudError(401);
}
