/** One line in a listener's diary: a rating or a save, dated when it first happened. */
export type DiaryEntry = {
  key: string;
  kind: 'track' | 'release';
  itemId: string;
  at: number;
  halfStars?: number;
  reviewed?: boolean;
  /** True for a save without a rating. */
  saved?: boolean;
  /** Saves carry their own display copy; ratings are looked up in the catalog. */
  title?: string;
  artistName?: string;
  artworkUrl?: string;
};
export type DiaryRating = { itemId: string; halfStars: number; review: string; createdAt: number };
export type DiarySave = {
  trackId: string;
  savedAt: number;
  title?: string;
  artistName?: string;
  artworkUrl?: string;
};
export type DiaryMonth = {
  key: string;
  label: string;
  ratings: number;
  saves: number;
  entries: DiaryEntry[];
};

/**
 * Merges ratings and saves into one newest-first log. A track that was both rated and
 * saved appears once, as the rating, on the earlier of the two dates.
 */
export function buildDiary(
  trackRatings: DiaryRating[],
  releaseRatings: DiaryRating[],
  saves: DiarySave[],
): DiaryEntry[] {
  const savedAt = new Map(saves.map((s) => [s.trackId, s]));
  const rated = new Set(trackRatings.map((r) => r.itemId));
  const entries: DiaryEntry[] = [
    ...trackRatings.map((r) => {
      const save = savedAt.get(r.itemId);
      return {
        key: `rating:${r.itemId}`,
        kind: 'track' as const,
        itemId: r.itemId,
        at: save && save.savedAt && save.savedAt < r.createdAt ? save.savedAt : r.createdAt,
        halfStars: r.halfStars,
        reviewed: !!r.review,
        title: save?.title,
        artistName: save?.artistName,
        artworkUrl: save?.artworkUrl,
      };
    }),
    ...releaseRatings.map((r) => ({
      key: `release:${r.itemId}`,
      kind: 'release' as const,
      itemId: r.itemId,
      at: r.createdAt,
      halfStars: r.halfStars,
      reviewed: !!r.review,
    })),
    ...saves
      .filter((s) => !rated.has(s.trackId))
      .map((s) => ({
        key: `save:${s.trackId}`,
        kind: 'track' as const,
        itemId: s.trackId,
        at: s.savedAt,
        saved: true,
        title: s.title,
        artistName: s.artistName,
        artworkUrl: s.artworkUrl,
      })),
  ];
  return entries.filter((e) => e.at > 0).sort((a, b) => b.at - a.at || a.key.localeCompare(b.key));
}

/** Groups a newest-first diary into calendar months (in the device's time zone). */
export function groupDiary(entries: DiaryEntry[]): DiaryMonth[] {
  const months: DiaryMonth[] = [];
  for (const entry of entries) {
    const date = new Date(entry.at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    let month = months.at(-1);
    if (month?.key !== key) {
      month = {
        key,
        label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        ratings: 0,
        saves: 0,
        entries: [],
      };
      months.push(month);
    }
    month.entries.push(entry);
    if (entry.saved) month.saves++;
    else month.ratings++;
  }
  return months;
}
