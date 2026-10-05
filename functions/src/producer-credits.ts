import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { authUid, db, FieldValue, rateLimit, requiredText, Timestamp } from './core';
import { normalizeName } from '../../shared/domain';

const token = defineSecret('GENIUS_ACCESS_TOKEN');
type Artist = {
  id: number;
  name: string;
  image_url?: string;
  url?: string;
  alternate_names?: string[];
  description?: { plain?: string };
};
export type GeniusSong = {
  id: number;
  title: string;
  url: string;
  song_art_image_url?: string;
  header_image_url?: string;
  release_date?: string;
  primary_artist: Artist;
  producer_artists?: Artist[];
};
export type GeniusRequest = (path: string) => Promise<{
  response: { song?: GeniusSong; artist?: Artist; songs?: GeniusSong[]; next_page?: number | null };
}>;
export class GeniusError extends Error {
  constructor(
    public status: number,
    public retrySeconds = 3600,
  ) {
    super(`Genius HTTP ${status}`);
  }
}
export function geniusRequest(accessToken: string, interval = 500): GeniusRequest {
  let last = 0;
  return async (path) => {
    if (!/^\/(?:songs\/\d+|artists\/\d+(?:\/songs)?)(?:\?[^#]*)?$/.test(path))
      throw new Error('Invalid Genius metadata path.');
    await delay(Math.max(0, last + interval - Date.now()));
    last = Date.now();
    const response = await fetch(`https://api.genius.com${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const retry = response.headers.get('retry-after');
      const parsed =
        retry && /^\d+$/.test(retry)
          ? Number(retry)
          : (Date.parse(retry || '') - Date.now()) / 1000;
      throw new GeniusError(response.status, Number.isFinite(parsed) ? Math.max(60, parsed) : 3600);
    }
    return response.json();
  };
}
const safeUrl = (value: unknown, image = false) => {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (image
        ? ['images.genius.com', 't2.genius.com', 'assets.genius.com'].includes(url.hostname)
        : url.hostname === 'genius.com')
      ? url.href
      : '';
  } catch {
    return '';
  }
};
export function production(song: GeniusSong, producerId: number) {
  if (
    !Number.isSafeInteger(song?.id) ||
    song.id <= 0 ||
    !song.title?.trim() ||
    !song.primary_artist?.name ||
    !Array.isArray(song.producer_artists)
  )
    throw new Error('Incomplete Genius song metadata.');
  if (!song.producer_artists.some((producer) => producer.id === producerId)) return null;
  const url = safeUrl(song.url);
  if (!url) throw new Error('Invalid Genius song link.');
  return {
    geniusId: song.id,
    title: song.title.slice(0, 500),
    artistName: song.primary_artist.name.slice(0, 200),
    artworkUrl: safeUrl(song.song_art_image_url || song.header_image_url, true),
    geniusUrl: url,
    releaseDate: song.release_date || null,
  };
}
/** One checkpointed page. Artist associations alone never establish a production credit. */
export async function syncProducerPage(producerId: string, request: GeniusRequest) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(producerId))
    throw new HttpsError('invalid-argument', 'Invalid producer.');
  const ref = db.doc(`producers/${producerId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError('not-found', 'Producer not found.');
  const producer = snapshot.data()!;
  if (producer.geniusSync?.complete) return { complete: true, added: 0, checked: 0 };
  const page: number = producer.geniusSync?.nextPage || 1;
  const lease = db.doc('_integrations/geniusProducerSync'),
    owner = randomUUID();
  await db.runTransaction(async (tx) => {
    const state = (await tx.get(lease)).data();
    if ((state?.cooldownUntil?.toMillis() || 0) > Date.now())
      throw new HttpsError(
        'resource-exhausted',
        'Genius is rate limited. Cached credits are still available; try again later.',
      );
    if ((state?.expiresAt?.toMillis() || 0) > Date.now())
      throw new HttpsError('aborted', 'Another producer is syncing. Try again shortly.');
    tx.set(lease, { owner, expiresAt: Timestamp.fromMillis(Date.now() + 240000) }, { merge: true });
  });
  try {
    let geniusId: number | undefined = producer.geniusId;
    if (!geniusId) {
      const names = new Set([producer.name, ...(producer.aliases || [])].map(normalizeName));
      const tracks = await db.collection('tracks').where('producerId', '==', producerId).get();
      const candidates = tracks.docs
        .filter((track) => Number.isSafeInteger(track.data().geniusId))
        .slice(0, 5);
      const identities = new Set<number>();
      for (const track of candidates) {
        const id = track.data().geniusId;
        const song = (await request(`/songs/${id}`)).response.song;
        if (!song || song.id !== id || !Array.isArray(song.producer_artists))
          throw new Error('Invalid Genius identity evidence.');
        for (const credit of song.producer_artists)
          if (Number.isSafeInteger(credit.id) && names.has(normalizeName(credit.name)))
            identities.add(credit.id);
      }
      if (identities.size !== 1)
        throw new HttpsError(
          'failed-precondition',
          'A unique Genius producer identity could not be verified from existing credits.',
        );
      geniusId = [...identities][0];
    }
    const artist = (await request(`/artists/${geniusId}?text_format=plain`)).response.artist;
    if (!artist || artist.id !== geniusId || !artist.name)
      throw new Error('Genius returned a different producer.');
    const response = (
      await request(`/artists/${geniusId}/songs?sort=title&per_page=25&page=${page}`)
    ).response;
    if (
      !Array.isArray(response.songs) ||
      response.songs.length > 25 ||
      !(
        response.next_page === null ||
        (Number.isSafeInteger(response.next_page) && response.next_page! > page)
      )
    )
      throw new Error('Invalid Genius pagination.');
    const ids = [...new Set(response.songs.map((song) => song.id))];
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0))
      throw new Error('Invalid Genius song ID.');
    const verified: { id: number; value: ReturnType<typeof production> }[] = [];
    for (const id of ids) {
      const song = (await request(`/songs/${id}`)).response.song;
      if (!song || song.id !== id) throw new Error('Genius returned a different song.');
      verified.push({ id, value: production(song, geniusId) });
    }
    return await db.runTransaction(async (tx) => {
      const [current, lock] = await Promise.all([tx.get(ref), tx.get(lease)]);
      if (
        !current.exists ||
        lock.data()?.owner !== owner ||
        (lock.data()?.expiresAt?.toMillis() || 0) <= Date.now()
      )
        throw new Error('Producer sync lease expired.');
      if (
        (current.data()!.geniusSync?.nextPage || 1) !== page ||
        current.data()!.geniusSync?.complete
      )
        throw new Error('Producer page already changed.');
      const rows = verified.map((song) => ref.collection('productions').doc(String(song.id)));
      const existing = rows.length ? await tx.getAll(...rows) : [];
      let added = 0;
      verified.forEach((song, i) => {
        if (song.value) {
          tx.set(rows[i], { ...song.value, checkedAt: FieldValue.serverTimestamp() });
          if (!existing[i].exists) added++;
        } else if (existing[i].exists) {
          tx.delete(rows[i]);
          added--;
        }
      });
      const image = safeUrl(artist.image_url, true);
      tx.update(ref, {
        geniusId,
        geniusUrl: safeUrl(artist.url),
        geniusName: artist.name,
        biography: (artist.description?.plain || '').trim().slice(0, 350),
        ...(image ? { imageUrl: image } : {}),
        geniusSync: {
          nextPage: response.next_page,
          complete: response.next_page === null,
          checkedSongs: (current.data()!.geniusSync?.checkedSongs || 0) + ids.length,
          verifiedCount: Math.max(0, (current.data()!.geniusSync?.verifiedCount || 0) + added),
          updatedAt: FieldValue.serverTimestamp(),
        },
      });
      return { complete: response.next_page === null, added, checked: ids.length };
    });
  } catch (error) {
    if (error instanceof GeniusError && error.status === 429)
      await lease.set(
        { cooldownUntil: Timestamp.fromMillis(Date.now() + error.retrySeconds * 1000) },
        { merge: true },
      );
    throw error;
  } finally {
    await db.runTransaction(async (tx) => {
      const state = await tx.get(lease);
      if (state.data()?.owner === owner) tx.update(lease, { expiresAt: Timestamp.fromMillis(0) });
    });
  }
}
export const syncProducerCredits = onCall(
  { secrets: [token], timeoutSeconds: 180, maxInstances: 2 },
  async (request) => {
    const uid = authUid(request);
    await rateLimit(uid, 'producerCredits', 60);
    try {
      return await syncProducerPage(
        requiredText(request.data?.producerId, 'producer', 100),
        geniusRequest(token.value()),
      );
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        error instanceof GeniusError && error.status === 429 ? 'resource-exhausted' : 'unavailable',
        'Genius credits could not be updated. Your cached credits are unchanged; try again later.',
      );
    }
  },
);
