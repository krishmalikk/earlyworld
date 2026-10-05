import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { readFile } from 'node:fs/promises';
import { normalizeSource } from '../shared/domain';
import { createHash } from 'node:crypto';
async function main() {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new Error('Set GCLOUD_PROJECT to the target Firebase project ID.');
  if (!process.env.FIRESTORE_EMULATOR_HOST && !process.argv.includes('--production'))
    throw new Error(
      'For a live project, explicitly pass --production. Otherwise set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080.',
    );
  initializeApp({
    projectId,
    ...(!process.env.FIRESTORE_EMULATOR_HOST ? { credential: applicationDefault() } : {}),
  });
  const db = getFirestore();
  const catalog = JSON.parse(await readFile('seed/catalog.json', 'utf8'));
  const artists = new Map<string, any>(catalog.artists.map((a: any) => [a.id, a])),
    producers = new Map<string, any>(catalog.producers.map((p: any) => [p.id, p]));
  let inserted = 0;
  for (const item of catalog.tracks) {
    const source = normalizeSource(item.sourceUrl),
      trackId = createHash('sha256').update(source.url).digest('hex');
    const created = await db.runTransaction(async (tx) => {
      const trackRef = db.doc(`tracks/${trackId}`),
        artistRef = db.doc(`artists/${item.artistId}`),
        producerRef = item.producerId ? db.doc(`producers/${item.producerId}`) : null;
      const [track, artist, producer] = await Promise.all([
        tx.get(trackRef),
        tx.get(artistRef),
        producerRef ? tx.get(producerRef) : Promise.resolve(null),
      ]);
      if (track.exists) return false;
      const { id: artistId, ...artistData } = artists.get(item.artistId);
      if (!artist.exists)
        tx.create(artistRef, {
          ...artistData,
          trackCount: 1,
          createdAt: FieldValue.serverTimestamp(),
        });
      else tx.update(artistRef, { trackCount: FieldValue.increment(1) });
      if (producerRef) {
        const { id: producerId, ...producerData } = producers.get(item.producerId);
        if (!producer?.exists) tx.create(producerRef, { ...producerData, trackCount: 1 });
        else tx.update(producerRef, { trackCount: FieldValue.increment(1) });
      }
      const { id, ...trackData } = item;
      tx.create(trackRef, {
        ...trackData,
        sourceUrl: source.url,
        sourcePlatform: source.platform,
        createdAt: Timestamp.fromDate(new Date(item.publishedAt)),
        addedByUid: 'catalog-seed',
        saveCount: 0,
        savers: [],
        saversCapped: false,
        geniusStatus: 'pending',
        geniusId: null,
        geniusUrl: null,
        geniusCheckedAt: null,
        credits: null,
      });
      return true;
    });
    if (created) inserted++;
  }
  console.log(
    `Seeded ${inserted} new tracks (${catalog.tracks.length - inserted} already present). Existing saves, credits, and counters preserved.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
