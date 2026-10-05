/** Read-only catalog integrity/count report; no credentials or user data in output. */
async function main() {
  if (!process.env.GCLOUD_PROJECT) throw new Error('Set GCLOUD_PROJECT.');
  const { db } = await import('../functions/src/core');
  try {
    const [tracks, artists, producers] = await Promise.all([
      db
        .collection('tracks')
        .select('artistId', 'sourcePlatform', 'soundcloud.urn', 'geniusStatus')
        .get(),
      db.collection('artists').select('trackCount').get(),
      db.collection('producers').count().get(),
    ]);
    const perArtist = new Map<string, number>(),
      urns = new Set<string>();
    const genius: Record<string, number> = {};
    let duplicateIdentities = 0,
      soundcloud = 0;
    for (const doc of tracks.docs) {
      const t = doc.data();
      perArtist.set(t.artistId, (perArtist.get(t.artistId) || 0) + 1);
      genius[t.geniusStatus || 'unknown'] = (genius[t.geniusStatus || 'unknown'] || 0) + 1;
      if (t.sourcePlatform === 'soundcloud') soundcloud++;
      if (t.soundcloud?.urn) {
        if (urns.has(t.soundcloud.urn)) duplicateIdentities++;
        urns.add(t.soundcloud.urn);
      }
    }
    const artistIds = new Set(artists.docs.map((d) => d.id));
    const missingArtists = [...perArtist.keys()].filter((id) => !artistIds.has(id)).length;
    const artistCountMismatches = artists.docs.filter(
      (d) => (d.data().trackCount || 0) !== (perArtist.get(d.id) || 0),
    ).length;
    console.log(
      JSON.stringify(
        {
          project: process.env.GCLOUD_PROJECT,
          tracks: tracks.size,
          artists: artists.size,
          producers: producers.data().count,
          soundcloud,
          uniqueSoundCloudTracks: urns.size,
          duplicateIdentities,
          missingArtists,
          artistCountMismatches,
          genius,
        },
        null,
        2,
      ),
    );
    if (duplicateIdentities || missingArtists || artistCountMismatches) process.exitCode = 1;
  } finally {
    await db.terminate();
  }
}
main().catch(() => {
  console.error('Catalog audit failed. Check project and admin credentials.');
  process.exitCode = 1;
});
