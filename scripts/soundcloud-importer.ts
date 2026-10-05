import { soundCloudSnapshot } from '../functions/src/provider-metadata';
import { db, FieldValue, Timestamp, hash } from '../functions/src/core';
import { soundCloudIdentityRef, soundCloudFields } from '../functions/src/soundcloud';
import { soundCloudMetadata, type SoundCloudMetadata } from '../functions/src/soundcloud-api';
import { normalizeName, SCENES } from '../shared/domain';

export type ImportArtist = {
  urn: string;
  name: string;
  profileUrl: string;
  avatarUrl: string;
  scenes: string[];
  existingId?: string;
};
/** These are track uploads from reviewed accounts, never likes, reposts, or search hits. */
export function eligibleUpload(raw: any, artistUrn: string): SoundCloudMetadata | null {
  try {
    const t = soundCloudMetadata(raw);
    if (
      t.uploader.urn !== artistUrn ||
      t.durationSeconds < 30 ||
      t.durationSeconds > 900 ||
      !t.publishedAt ||
      Date.parse(t.publishedAt) > Date.now() ||
      /\b(leak(?:ed)?|unreleased|snippet|preview|type beat|full album|full mixtape)\b/i.test(
        t.title,
      )
    )
      return null;
    return t;
  } catch {
    return null;
  }
}
/** One atomic page: identities and counters commit together. Safe after retries or interrupted imports. */
export async function importArtistPage(
  artist: ImportArtist,
  values: SoundCloudMetadata[],
  remaining: number,
) {
  if (
    !/^soundcloud:users:\d+$/.test(artist.urn) ||
    !artist.name.trim() ||
    artist.scenes.some((scene) => !(SCENES as readonly string[]).includes(scene))
  )
    throw new Error('Invalid reviewed artist.');
  const tracks = [...new Map(values.map((t) => [t.urn, t])).values()];
  if (tracks.length > 100 || tracks.some((t) => t.uploader.urn !== artist.urn))
    throw new Error('Invalid import page.');
  const artistId = artist.existingId || `artist_${hash(normalizeName(artist.name)).slice(0, 24)}`;
  return db.runTransaction(async (tx) => {
    const artistRef = db.doc(`artists/${artistId}`);
    const artistSnap = await tx.get(artistRef);
    if (artistSnap.exists && artistSnap.data()!.soundcloud?.urn !== artist.urn)
      throw new Error('Artist identity conflict; review before importing.');
    const refs = tracks.map((t) => ({
      identity: soundCloudIdentityRef(t.urn),
      track: db.doc(`tracks/${hash(t.permalinkUrl)}`),
    }));
    const snapshots = refs.length
      ? await tx.getAll(...refs.flatMap((r) => [r.identity, r.track]))
      : [];
    let added = 0,
      existing = 0;
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i],
        r = refs[i];
      if (snapshots[i * 2].exists || snapshots[i * 2 + 1].exists) {
        existing++;
        continue;
      }
      if (added >= remaining) break;
      tx.create(r.track, {
        ...soundCloudFields(t),
        sourcePlatform: 'soundcloud',
        artistId,
        artistName: artist.name,
        producerId: null,
        producerName: null,
        // Original publication date keeps older imports from flooding followed-artist release feeds.
        createdAt: Timestamp.fromDate(new Date(t.publishedAt!)),
        publishedAt: t.publishedAt,
        importedAt: FieldValue.serverTimestamp(),
        addedByUid: 'soundcloud-catalog-import',
        saveCount: 0,
        savers: [],
        saversCapped: false,
        ratingCount: 0,
        ratingHalfStarSum: 0,
        // Bulk imports must not launch thousands of unbounded Genius API calls.
        geniusStatus: 'deferred',
        geniusId: null,
        geniusUrl: null,
        geniusCheckedAt: null,
        credits: null,
      });
      tx.create(
        db.doc(`_providerMetadata/${r.track.id}/sources/soundcloud`),
        soundCloudSnapshot(t),
      );
      tx.create(r.identity, { trackId: r.track.id, urn: t.urn });
      added++;
    }
    if (added) {
      if (artistSnap.exists) tx.update(artistRef, { trackCount: FieldValue.increment(added) });
      else
        tx.create(artistRef, {
          name: artist.name,
          aliases: [],
          scenes: artist.scenes,
          imageUrl: artist.avatarUrl,
          sourceUrl: artist.profileUrl,
          soundcloud: {
            urn: artist.urn,
            name: artist.name,
            profileUrl: artist.profileUrl,
            avatarUrl: artist.avatarUrl,
          },
          trackCount: added,
          createdAt: FieldValue.serverTimestamp(),
        });
    }
    return { added, existing, artistId };
  });
}
