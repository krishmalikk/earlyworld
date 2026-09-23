export type EntityType = 'artist' | 'producer';
export type Tier = 'gold' | 'platinum' | 'multiplatinum' | 'diamond' | null;
export const SCENES = [
  'plugg',
  'pluggnb',
  'rage',
  'jerk',
  'dark plugg',
  'hyperpop',
  'sample drill',
  'Detroit',
  'Memphis',
  'experimental',
  'cloud rap',
  'UK underground',
] as const;
export function tierFor(score: number): Tier {
  return score >= 150
    ? 'diamond'
    : score >= 60
      ? 'multiplatinum'
      : score >= 25
        ? 'platinum'
        : score >= 10
          ? 'gold'
          : null;
}
export const rarityWeight = (saves: number) => 1 / Math.log(2 + Math.max(0, saves));
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
export function recentWeekKeys(now: Date, count = 52): Set<string> {
  return new Set(
    Array.from({ length: count }, (_, i) => isoWeek(new Date(now.getTime() - i * 7 * 86400000))),
  );
}
export function rotationScore(
  trackSaveCounts: number[],
  weeks: string[],
  lastEngaged: Date,
  now = new Date(),
) {
  const distinctTracks = trackSaveCounts.length;
  const recent = recentWeekKeys(now);
  const consistency = new Set(weeks.filter((w) => recent.has(w))).size;
  const depth = distinctTracks
    ? trackSaveCounts.reduce((sum, n) => sum + rarityWeight(n), 0) / distinctTracks
    : 0;
  const weeksSince = Math.max(0, (now.getTime() - lastEngaged.getTime()) / (7 * 86400000));
  const score =
    10 * Math.log(1 + distinctTracks) * consistency * depth * Math.pow(0.5, weeksSince / 26);
  return {
    score,
    tier: tierFor(score),
    distinctTracks,
    distinctWeeks: consistency,
    avgDepthWeight: depth,
  };
}
export function nextSavers(current: string[], capped: boolean, uid: string) {
  if (capped || current.includes(uid))
    return { savers: current, saversCapped: capped, append: false };
  if (current.length >= 200) return { savers: current, saversCapped: true, append: false };
  return { savers: [...current, uid], saversCapped: false, append: true };
}
export function cappedUnion<T>(values: T[], value: T, cap: number): T[] {
  return values.includes(value) || values.length >= cap ? values : [...values, value];
}
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\[(].*?[\])]/g, ' ')
    .replace(/\b(feat\.?|ft\.?|featuring|prod\.?\s*(?:by)?)(?:\s+).*$/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
export function similarity(a: string, b: string): number {
  a = normalizeName(a);
  b = normalizeName(b);
  if (!a || !b) return 0;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + Number(a[i - 1] !== b[j - 1]));
    row = next;
  }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}
export function normalizeSource(input: string): {
  url: string;
  platform: 'youtube' | 'soundcloud' | 'bandcamp';
} {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    throw new Error('Paste a full public track URL.');
  }
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.port)
    throw new Error('Use a public HTTPS track URL.');
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
    const id =
      host === 'youtu.be'
        ? u.pathname.slice(1)
        : u.searchParams.get('v') || u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) throw new Error('Paste a YouTube video URL.');
    return { url: `https://www.youtube.com/watch?v=${id}`, platform: 'youtube' };
  }
  if (host === 'soundcloud.com' || host === 'm.soundcloud.com') {
    const path = u.pathname.replace(/\/+$/, '');
    if (!/^\/[\w-]+\/[\w-]+$/.test(path) || /\/(sets|likes|reposts|tracks)$/.test(path))
      throw new Error('Paste a single public SoundCloud track URL.');
    return { url: `https://soundcloud.com${path}`, platform: 'soundcloud' };
  }
  if (/^[a-z0-9-]+\.bandcamp\.com$/.test(host) && /^\/track\/[a-z0-9-]+\/?$/.test(u.pathname))
    return { url: `https://${host}${u.pathname.replace(/\/$/, '')}`, platform: 'bandcamp' };
  throw new Error('Use a SoundCloud, YouTube, or Bandcamp track URL.');
}
export type MatchTrack = {
  id: string;
  title: string;
  artistName: string;
  saveCount: number;
  savers: string[];
  saversCapped: boolean;
};
export function matchScores(uid: string, tracks: MatchTrack[]) {
  const scores = new Map<
    string,
    {
      uid: string;
      score: number;
      sharedTracks: { trackId: string; title: string; artistName: string; saveCount: number }[];
    }
  >();
  for (const track of tracks) {
    if (track.saversCapped) continue;
    for (const other of new Set(track.savers)) {
      if (other === uid) continue;
      const entry = scores.get(other) || { uid: other, score: 0, sharedTracks: [] };
      entry.score += rarityWeight(track.saveCount);
      entry.sharedTracks.push({
        trackId: track.id,
        title: track.title,
        artistName: track.artistName,
        saveCount: track.saveCount,
      });
      scores.set(other, entry);
    }
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score || a.uid.localeCompare(b.uid))
    .slice(0, 25)
    .map((m) => ({
      ...m,
      sharedTracks: m.sharedTracks.sort((a, b) => a.saveCount - b.saveCount).slice(0, 3),
    }));
}
