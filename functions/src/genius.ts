import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { db, FieldValue, hash, requiredText } from './core';
import { normalizeName, similarity } from '../../shared/domain';
const GENIUS_ACCESS_TOKEN = defineSecret('GENIUS_ACCESS_TOKEN');
type Song = {
  id: number;
  url: string;
  title: string;
  primary_artist: { name: string };
  producer_artists?: { name: string }[];
  writer_artists?: { name: string }[];
  custom_performances?: { label: string; artists: { name: string }[] }[];
  album?: { name: string };
  release_date?: string;
};
async function api(path: string) {
  const response = await fetch(`https://api.genius.com${path}`, {
    headers: { Authorization: `Bearer ${GENIUS_ACCESS_TOKEN.value()}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Genius HTTP ${response.status}`);
  return response.json() as Promise<{ response: { hits?: { result: Song }[]; song?: Song } }>;
}
async function enrich(trackId: string, manual = false) {
  const ref = db.doc(`tracks/${trackId}`),
    snap = await ref.get();
  if (!snap.exists) return;
  const track = snap.data()!;
  if (!manual && track.geniusStatus !== 'pending') return;
  if (!manual) {
    const job = db.doc(`_geniusJobs/${trackId}`);
    const claimed = await db.runTransaction(async (tx) => {
      const seen = await tx.get(job);
      if (seen.exists) return false;
      tx.create(job, { startedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!claimed) return;
  }
  try {
    const search = await api(
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
      await ref.update({
        geniusStatus: 'unmatched',
        geniusCheckedAt: FieldValue.serverTimestamp(),
        credits: null,
      });
      return;
    }
    const song = (await api(`/songs/${hits[0].id}`)).response.song!;
    const producers = (song.producer_artists || []).map((p) => p.name);
    await db.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists) return;
      const producerName = !current.data()!.producerName ? producers[0] : null;
      const producerId = producerName
        ? `producer_${hash(normalizeName(producerName)).slice(0, 24)}`
        : null;
      const producerRef = producerId ? db.doc(`producers/${producerId}`) : null;
      const producer = producerRef ? await tx.get(producerRef) : null;
      if (producerRef) {
        if (!producer?.exists)
          tx.create(producerRef, {
            name: producerName,
            imageUrl: '',
            aliases: [],
            tagAudioUrl: null,
            trackCount: 1,
          });
        else tx.update(producerRef, { trackCount: FieldValue.increment(1) });
      }
      tx.update(ref, {
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
    });
  } catch (error) {
    logger.warn('Genius enrichment unavailable', { trackId, error: String(error) });
    await ref.update({
      geniusStatus: 'unmatched',
      geniusCheckedAt: FieldValue.serverTimestamp(),
      credits: null,
    });
  }
}
export const enrichFromGenius = onDocumentCreated(
  { document: 'tracks/{trackId}', secrets: [GENIUS_ACCESS_TOKEN], retry: false },
  (event) => enrich(event.params.trackId),
);
export const adminEnrichTrack = onCall({ secrets: [GENIUS_ACCESS_TOKEN] }, async (request) => {
  if (request.auth?.token.admin !== true) throw new HttpsError('permission-denied', 'Admin only.');
  await enrich(requiredText(request.data?.trackId, 'track', 100), true);
  return { done: true };
});
