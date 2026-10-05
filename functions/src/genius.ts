import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { db, FieldValue, hash, requiredText } from './core';
import { normalizeName, similarity } from '../../shared/domain';
export const GENIUS_ACCESS_TOKEN = defineSecret('GENIUS_ACCESS_TOKEN');
export type Song = {
  id: number;
  url: string;
  title: string;
  primary_artist: { name: string };
  producer_artists?: { name: string; id?: number; image_url?: string; url?: string }[];
  writer_artists?: { name: string }[];
  custom_performances?: { label: string; artists: { name: string }[] }[];
  album?: { name: string };
  release_date?: string;
};
export class GeniusRequestError extends Error {
  readonly retryAt: number;
  constructor(
    readonly status: number,
    retryAfter: string | null,
  ) {
    super(`Genius HTTP ${status}`);
    const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : null;
    const parsed = seconds !== null ? Date.now() + seconds * 1000 : Date.parse(retryAfter || '');
    this.retryAt = Number.isFinite(parsed) ? parsed : 0;
  }
}
export async function geniusApi(path: string) {
  const response = await fetch(`https://api.genius.com${path}`, {
    headers: { Authorization: `Bearer ${GENIUS_ACCESS_TOKEN.value()}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new GeniusRequestError(response.status, response.headers.get('retry-after'));
  return response.json() as Promise<{ response: { hits?: { result: Song }[]; song?: Song } }>;
}
export async function enrich(
  trackId: string,
  manual = false,
  batch?: { request: typeof geniusApi },
): Promise<'matched' | 'unmatched' | 'ambiguous' | 'skipped'> {
  const ref = db.doc(`tracks/${trackId}`),
    snap = await ref.get();
  if (!snap.exists) return 'skipped';
  const track = snap.data()!;
  const eligible = (value: FirebaseFirestore.DocumentData) =>
    !batch ||
    (['pending', 'deferred', 'error'].includes(value.geniusStatus) &&
      !value.credits &&
      value.title === track.title &&
      value.artistName === track.artistName);
  if (!eligible(track)) return 'skipped';
  const request = batch?.request || geniusApi;
  async function unmatched(
    status: 'unmatched' | 'ambiguous' = 'unmatched',
  ): Promise<'unmatched' | 'ambiguous' | 'skipped'> {
    return db.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists || !eligible(current.data()!) || current.data()!.credits)
        return 'skipped';
      tx.update(ref, {
        geniusStatus: status,
        geniusCheckedAt: FieldValue.serverTimestamp(),
        credits: null,
      });
      return status;
    });
  }
  // A local-only simulator session has no Genius credential to send upstream.
  if (
    process.env.FUNCTIONS_EMULATOR === 'true' &&
    GENIUS_ACCESS_TOKEN.value() === 'emulator-disabled'
  ) {
    return unmatched();
  }
  if (!manual && track.geniusStatus !== 'pending') return 'skipped';
  if (!manual) {
    const job = db.doc(`_geniusJobs/${trackId}`);
    const claimed = await db.runTransaction(async (tx) => {
      const seen = await tx.get(job);
      if (seen.exists) return false;
      tx.create(job, { startedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!claimed) return 'skipped';
  }
  try {
    const search = await request(
      `/search?q=${encodeURIComponent(`${track.title} ${track.artistName}`)}`,
    );
    const hits = (search.response.hits || [])
      .map((h) => h.result)
      .filter(
        (h) =>
          similarity(track.artistName, h.primary_artist.name) >= 0.85 &&
          similarity(track.title, h.title) >= 0.8,
      );
    hits.sort(
      (a, b) =>
        similarity(track.title, b.title) +
        similarity(track.artistName, b.primary_artist.name) -
        (similarity(track.title, a.title) + similarity(track.artistName, a.primary_artist.name)),
    );
    // Ambiguous near-ties are more dangerous than missing credits.
    if (
      !hits.length ||
      (hits.length > 1 &&
        hits[0].id !== hits[1].id &&
        Math.abs(similarity(track.title, hits[0].title) - similarity(track.title, hits[1].title)) <
          0.05)
    ) {
      return unmatched(hits.length ? 'ambiguous' : 'unmatched');
    }
    const song = (await request(`/songs/${hits[0].id}`)).response.song;
    if (
      !song ||
      song.id !== hits[0].id ||
      !song.primary_artist?.name ||
      similarity(track.artistName, song.primary_artist.name) < 0.85 ||
      similarity(track.title, song.title) < 0.8
    ) {
      throw new Error('Genius returned inconsistent song details');
    }
    const producers = (song.producer_artists || []).map((p) => p.name);
    return db.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists || !eligible(current.data()!)) return 'skipped';
      const producerName = !current.data()!.producerName ? producers[0] : null;
      const producerId = producerName
        ? `producer_${hash(normalizeName(producerName)).slice(0, 24)}`
        : null;
      const previousIds: string[] =
        current.data()!.producerIds ||
        (current.data()!.producerId ? [current.data()!.producerId] : []);
      const verified = (song.producer_artists || [])
        .map((person) => ({
          ...person,
          key: `producer_${hash(normalizeName(person.name)).slice(0, 24)}`,
        }))
        .filter((person, index, all) => all.findIndex((p) => p.key === person.key) === index);
      const records = await Promise.all(
        verified.map((person) => tx.get(db.doc(`producers/${person.key}`))),
      );
      for (const [index, person] of verified.entries()) {
        const producerRef = records[index].ref;
        const details =
          typeof person.id === 'number'
            ? { geniusId: person.id, ...(person.url ? { geniusUrl: person.url } : {}) }
            : {};
        if (!records[index].exists)
          tx.create(producerRef, {
            name: person.name,
            imageUrl: person.image_url || '',
            aliases: [],
            tagAudioUrl: null,
            trackCount: 1,
            ...details,
          });
        else if (!previousIds.includes(person.key))
          tx.update(producerRef, { trackCount: FieldValue.increment(1), ...details });
      }
      tx.set(db.doc(`_providerMetadata/${trackId}/sources/genius`), {
        provider: 'genius',
        providerId: song.id,
        status: 'matched',
        sourceUrl: song.url,
        producers,
        writers: (song.writer_artists || []).map((p) => p.name),
        releaseDate: song.release_date || null,
        album: song.album?.name || null,
        lastSuccessfulFetchAt: FieldValue.serverTimestamp(),
        lastAttemptAt: FieldValue.serverTimestamp(),
        retentionPolicy: 'pending',
        expiresAt: null,
      });
      tx.update(ref, {
        producerIds: [...new Set([...previousIds, ...verified.map((person) => person.key)])],
        geniusStatus: 'matched',
        geniusId: song.id,
        geniusUrl: song.url,
        geniusCheckedAt: FieldValue.serverTimestamp(),
        credits: {
          producers,
          writers: (song.writer_artists || []).map((p) => p.name),
          performances: (song.custom_performances || []).map((p) => ({
            role: p.label,
            artists: p.artists.map((a) => a.name),
          })),
          album: song.album?.name || null,
          releaseDate: song.release_date || null,
        },
        ...(producerId ? { producerId, producerName } : {}),
      });
      return 'matched';
    });
  } catch (error) {
    // Bulk runs must stop on provider failures, leaving deferred work retryable.
    if (batch) throw error;
    logger.warn('Genius enrichment unavailable', {
      trackId,
      code: error instanceof GeniusRequestError ? error.status : 'provider-failure',
    });
    await db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data();
      if (
        current &&
        !current.credits &&
        current.title === track.title &&
        current.artistName === track.artistName
      )
        tx.update(ref, { geniusStatus: 'error', geniusAttemptedAt: FieldValue.serverTimestamp() });
    });
    return 'skipped';
  }
}
export const enrichFromGenius = onDocumentCreated(
  { document: 'tracks/{trackId}', retry: true },
  async (event) => {
    const { enqueueGenius } = await import('./catalog-jobs');
    await enqueueGenius(event.params.trackId, 0);
  },
);
export const adminEnrichTrack = onCall({ secrets: [GENIUS_ACCESS_TOKEN] }, async (request) => {
  if (request.auth?.token.admin !== true) throw new HttpsError('permission-denied', 'Admin only.');
  await enrich(requiredText(request.data?.trackId, 'track', 100), true);
  return { done: true };
});
