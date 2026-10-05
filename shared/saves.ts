/** Saving is an explicit, idempotent intent; stale UI must not overwrite an existing save. */
export type SaveSource = {
  title: string;
  artistId: string;
  artistName: string;
  producerId?: string | null;
  producerName?: string | null;
  artworkUrl?: string;
  saveCount?: number;
};
export type SaveTransaction = {
  get(path: string): Promise<SaveSource | undefined>;
  set(path: string, value: Record<string, unknown>): void;
  delete(path: string): void;
};
export async function applySaveIntent(
  tx: SaveTransaction,
  uid: string,
  trackId: string,
  desired: boolean,
  timestamp: unknown,
) {
  const path = `users/${uid}/saves/${trackId}`;
  const existing = await tx.get(path);
  if (!!existing === desired) return;
  if (!desired) {
    tx.delete(path);
    return;
  }
  const track = await tx.get(`tracks/${trackId}`);
  if (!track) throw new Error('This track is no longer available. Choose another track.');
  tx.set(path, {
    trackId,
    savedAt: timestamp,
    title: track.title,
    artistId: track.artistId,
    artistName: track.artistName,
    producerId: track.producerId ?? null,
    producerName: track.producerName ?? null,
    artworkUrl: track.artworkUrl || '',
    saveCountAtSave: track.saveCount || 0,
  });
}
