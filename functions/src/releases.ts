import { randomUUID } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { authUid, db, FieldValue, hash, rateLimit, requiredText } from './core';
import { soundCloudToken, soundCloudSecrets, soundCloudIdentityRef } from './soundcloud';
import { soundCloudMetadata, SoundCloudError } from './soundcloud-api';

class IncompleteReleaseError extends Error {}
const releaseTypes = new Set(['album', 'ep', 'mixtape', 'compilation', 'single']);
const origin = 'https://api.soundcloud.com';
const importVersion = 2;
export function releaseMetadataUrl(value: string, path?: string) {
  const url = new URL(value, origin);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    url.hash ||
    !/^\/(users\/(?:\d+|soundcloud(?::|%3A)users(?::|%3A)\d+)\/playlists|playlists\/(?:\d+|soundcloud(?::|%3A)playlists(?::|%3A)\d+)(?:\/tracks)?|tracks\/(?:\d+|soundcloud(?::|%3A)tracks(?::|%3A)\d+))$/i.test(
      url.pathname,
    ) ||
    (path && url.pathname !== path)
  )
    throw new Error('Invalid release metadata endpoint.');
  for (const key of ['client_id', 'client_secret', 'oauth_token', 'access_token'])
    url.searchParams.delete(key);
  return url;
}
export async function releaseRequest(
  value: string,
  getToken = soundCloudToken,
  request: typeof fetch = fetch,
): Promise<any> {
  const url = releaseMetadataUrl(value);
  let token = await getToken();
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await request(url, {
      headers: { Authorization: `OAuth ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401 && attempt === 0) {
      token = await getToken(token);
      continue;
    }
    if (!response.ok) throw new SoundCloudError(response.status);
    return response.json();
  }
  throw new SoundCloudError(401);
}
const publicUrl = (value: unknown) => {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
};
const providerUrn = (raw: any, kind: string) =>
  typeof raw?.urn === 'string' && new RegExp(`^soundcloud:${kind}:\\d+$`).test(raw.urn)
    ? raw.urn
    : Number.isSafeInteger(raw?.id) && raw.id > 0
      ? `soundcloud:${kind}:${raw.id}`
      : '';
/** Classification must be supplied by the artist, never inferred from a title or track count. */
export function releaseMetadata(raw: any, artistUrn: string) {
  const type = String(raw?.playlist_type || '').toLowerCase();
  const urn = providerUrn(raw, 'playlists');
  const source = publicUrl(raw?.permalink_url);
  const sourceUrl = source
    ? (() => {
        const url = new URL(source);
        url.search = '';
        url.hash = '';
        return url.href;
      })()
    : '';
  if (
    raw?.kind !== 'playlist' ||
    raw.sharing !== 'public' ||
    !releaseTypes.has(type) ||
    providerUrn(raw.user, 'users') !== artistUrn ||
    !urn ||
    !/^https:\/\/soundcloud\.com\/[^/]+\/sets\/[^/?#]+\/?$/.test(sourceUrl) ||
    typeof raw.title !== 'string' ||
    !raw.title.trim()
  )
    return null;
  let releasedAt: string | null = null;
  if (typeof raw.release_date === 'string' && Number.isFinite(Date.parse(raw.release_date)))
    releasedAt = new Date(raw.release_date).toISOString().slice(0, 10);
  else if (
    Number.isInteger(raw.release_year) &&
    raw.release_year >= 1900 &&
    raw.release_year <= 2200
  ) {
    releasedAt = String(raw.release_year);
    if (Number.isInteger(raw.release_month) && raw.release_month >= 1 && raw.release_month <= 12) {
      releasedAt += `-${String(raw.release_month).padStart(2, '0')}`;
      if (Number.isInteger(raw.release_day) && raw.release_day >= 1 && raw.release_day <= 31)
        releasedAt += `-${String(raw.release_day).padStart(2, '0')}`;
    }
  }
  return {
    urn,
    title: raw.title.trim().slice(0, 200) as string,
    releaseType: type,
    sourceUrl,
    artworkUrl: publicUrl(raw.artwork_url),
    releasedAt,
  };
}

export async function storeRelease(
  artistId: string,
  artist: { name: string; soundcloud: { urn: string } },
  raw: any,
  rawTracks: any[],
) {
  const metadata = releaseMetadata(raw, artist.soundcloud.urn);
  if (!metadata) return false;
  if (!rawTracks.length || rawTracks.length > 200 || rawTracks.length !== raw.track_count)
    throw new IncompleteReleaseError('Incomplete release tracklist.');
  // Reject incomplete/private metadata rather than publishing a guessed or partial tracklist.
  const tracks = rawTracks.map((raw) => {
    try {
      return soundCloudMetadata(raw);
    } catch {
      throw new IncompleteReleaseError('Track metadata unavailable.');
    }
  });
  const ref = db.doc(`releases/${hash(metadata.urn)}`);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists && existing.data()!.artistId !== artistId)
      throw new Error('Release identity conflict.');
    const matches = await tx.getAll(
      ...tracks.flatMap((t) => [
        soundCloudIdentityRef(t.urn),
        db.doc(`tracks/${hash(t.permalinkUrl)}`),
      ]),
    );
    const mappedIds = tracks.map((_, i) => matches[i * 2].data()?.trackId as string | undefined);
    const unique = [...new Set(mappedIds.filter((id): id is string => !!id))];
    const mappedDocs = unique.length
      ? await tx.getAll(...unique.map((id) => db.doc(`tracks/${id}`)))
      : [];
    const valid = new Set(mappedDocs.filter((d) => d.exists).map((d) => d.id));
    tx.set(
      ref,
      {
        ...metadata,
        artistId,
        artistName: artist.name,
        artworkUrl: metadata.artworkUrl || tracks[0].artworkUrl,
        tracks: tracks.map((t, i) => ({
          urn: t.urn,
          trackId:
            mappedIds[i] && valid.has(mappedIds[i]!)
              ? mappedIds[i]
              : matches[i * 2 + 1].exists
                ? matches[i * 2 + 1].id
                : null,
          title: t.title,
          artistName: t.artistName,
          artworkUrl: t.artworkUrl,
          sourceUrl: t.permalinkUrl,
          durationSeconds: t.durationSeconds,
        })),
        updatedAt: FieldValue.serverTimestamp(),
        ...(!existing.exists
          ? { createdAt: FieldValue.serverTimestamp(), ratingCount: 0, ratingHalfStarSum: 0 }
          : {}),
      },
      { merge: true },
    );
  });
  return true;
}

/** One checkpointed page for a previously reviewed catalog artist, with a per-artist lease. */
export async function syncArtistReleasePage(artistId: string, request = releaseRequest) {
  const ref = db.doc(`artists/${artistId}`),
    leaseRef = db.doc(`_releaseSync/${artistId}`),
    lease = randomUUID();
  const artist = await db.runTransaction(async (tx) => {
    const [snap, lock] = await Promise.all([tx.get(ref), tx.get(leaseRef)]);
    const data = snap.data();
    if (!data || !/^soundcloud:users:\d+$/.test(data.soundcloud?.urn))
      throw new HttpsError(
        'failed-precondition',
        'This artist needs a verified SoundCloud account first.',
      );
    if (data.releaseSync?.version === importVersion && data.releaseSync.complete) return null;
    if (lock.data()?.until > Date.now())
      throw new HttpsError(
        'resource-exhausted',
        'Releases are already being refreshed. Try again shortly.',
      );
    tx.set(leaseRef, { lease, until: Date.now() + 240000 });
    return data;
  });
  if (!artist) return { complete: true, imported: 0 };
  let imported = 0,
    skipped = 0;
  try {
    const path = `/users/${encodeURIComponent(artist.soundcloud.urn)}/playlists`;
    const url = releaseMetadataUrl(
      (artist.releaseSync?.version === importVersion ? artist.releaseSync.nextHref : null) ||
        `${path}?limit=5&linked_partitioning=true&show_tracks=false`,
      path,
    );
    const page = await request(url.href);
    const entries = Array.isArray(page) ? page : page.collection;
    if (!Array.isArray(entries) || entries.length > 5) throw new Error('Invalid release page.');
    const nextHref = page.next_href ? releaseMetadataUrl(page.next_href, path).href : null;
    if (nextHref === url.href) throw new Error('Release pagination did not advance.');
    for (const entry of entries) {
      try {
        if (!releaseMetadata(entry, artist.soundcloud.urn)) continue;
        const playlist = await request(
          `/playlists/${encodeURIComponent(providerUrn(entry, 'playlists'))}?show_tracks=true`,
        );
        if (!releaseMetadata(playlist, artist.soundcloud.urn)) continue;
        if (
          !Number.isInteger(playlist.track_count) ||
          playlist.track_count < 1 ||
          playlist.track_count > 200
        ) {
          skipped++;
          continue;
        }
        // The playlist tracks endpoint returns ordered pages; do not sort by title or catalog order.
        const trackPath = `/playlists/${encodeURIComponent(providerUrn(entry, 'playlists'))}/tracks`;
        let trackUrl: string | null = `${trackPath}?limit=100&linked_partitioning=true`;
        const tracks: any[] = [],
          seen = new Set<string>();
        while (trackUrl) {
          const safe = releaseMetadataUrl(trackUrl, trackPath).href;
          if (seen.has(safe) || seen.size >= 3) throw new Error('Invalid tracklist pagination.');
          seen.add(safe);
          const trackPage = await request(safe);
          const values = Array.isArray(trackPage) ? trackPage : trackPage.collection;
          if (!Array.isArray(values)) throw new Error('Invalid release tracklist.');
          tracks.push(...values);
          if (tracks.length > 200) throw new Error('Release tracklist is too large.');
          trackUrl = trackPage.next_href || null;
        }
        if (
          await storeRelease(
            artistId,
            artist as { name: string; soundcloud: { urn: string } },
            playlist,
            tracks,
          )
        )
          imported++;
      } catch (error) {
        if (
          error instanceof IncompleteReleaseError ||
          (error instanceof SoundCloudError && [403, 404, 410].includes(error.status))
        )
          skipped++;
        else throw error;
      }
    }
    await db.runTransaction(async (tx) => {
      const lock = await tx.get(leaseRef);
      if (lock.data()?.lease !== lease) throw new Error('Release lease expired.');
      tx.update(ref, {
        releaseSync: {
          version: importVersion,
          skippedReleases:
            (artist.releaseSync?.version === importVersion
              ? artist.releaseSync.skippedReleases || 0
              : 0) + skipped,
          nextHref,
          complete: !nextHref,
          updatedAt: FieldValue.serverTimestamp(),
        },
      });
      tx.delete(leaseRef);
    });
    return { imported, skipped, complete: !nextHref };
  } finally {
    await db.runTransaction(async (tx) => {
      const lock = await tx.get(leaseRef);
      if (lock.data()?.lease === lease) tx.delete(leaseRef);
    });
  }
}
export const syncArtistReleases = onCall(
  { secrets: soundCloudSecrets, timeoutSeconds: 180, maxInstances: 2 },
  async (request) => {
    const uid = authUid(request),
      artistId = requiredText(request.data?.artistId, 'artist', 100);
    if (!/^[\w-]+$/.test(artistId)) throw new HttpsError('invalid-argument', 'Choose an artist.');
    await rateLimit(uid, 'releaseSync', 30);
    try {
      return await syncArtistReleasePage(artistId);
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        'unavailable',
        'Release import could not finish. Retry later; already imported releases remain available.',
      );
    }
  },
);

/** Round-robin backfill only across artists already in earlyworld. No artist creation. */
export async function syncReleaseCatalogPage(sync = syncArtistReleasePage) {
  const stateRef = db.doc('_integrations/releaseCatalog'),
    lease = randomUUID();
  const state = await db.runTransaction(async (tx) => {
    const state = (await tx.get(stateRef)).data() || {};
    if (state.until > Date.now())
      throw new HttpsError(
        'resource-exhausted',
        'The release catalog is being refreshed. Try again shortly.',
      );
    tx.set(stateRef, { lease, until: Date.now() + 360000 }, { merge: true });
    return state;
  });
  let imported = 0,
    checked = 0,
    unfinished = false;
  try {
    // The beta has a bounded, reviewed artist roster. Keep a cursor between calls.
    const artists = await db.collection('artists').orderBy('name').get();
    const eligible = artists.docs.filter(
      (a) =>
        /^soundcloud:users:\d+$/.test(a.data().soundcloud?.urn) &&
        !(a.data().releaseSync?.version === importVersion && a.data().releaseSync?.complete),
    );
    const after = eligible.findIndex((a) => a.id === state.afterArtist);
    const ordered = [...eligible.slice(after + 1), ...eligible.slice(0, after + 1)].slice(0, 5);
    for (const artist of ordered) {
      const page = await sync(artist.id);
      imported += page.imported;
      checked++;
      unfinished ||= !page.complete;
      await db.runTransaction(async (tx) => {
        const lock = await tx.get(stateRef);
        if (lock.data()?.lease !== lease) throw new Error('Catalog lease expired.');
        tx.update(stateRef, { afterArtist: artist.id });
      });
    }
    return { imported, checked, complete: eligible.length <= checked && !unfinished };
  } finally {
    await db.runTransaction(async (tx) => {
      const lock = await tx.get(stateRef);
      if (lock.data()?.lease === lease)
        tx.update(stateRef, { lease: FieldValue.delete(), until: FieldValue.delete() });
    });
  }
}
export const syncReleaseCatalog = onCall(
  { secrets: soundCloudSecrets, timeoutSeconds: 300, maxInstances: 1 },
  async (request) => {
    const uid = authUid(request);
    await rateLimit(uid, 'releaseCatalogSync', 30);
    try {
      return await syncReleaseCatalogPage();
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        'unavailable',
        'Could not finish refreshing releases. Retry later to continue.',
      );
    }
  },
);
