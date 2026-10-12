/** Share-card geometry, tokens and selection logic. Card space is a 360×640 story frame. */
export const CARD = { width: 360, height: 640, exportWidth: 1080, exportHeight: 1920 } as const;

/** Card-only type and spacing scale, matching the approved designs. */
export const cardType = {
  micro: 8.5,
  label: 9.5,
  mono: 10,
  small: 11,
  body: 12,
  credit: 12.5,
  meta: 13,
  wordmark: 14,
  stat: 16,
  title: 17,
  handle: 18,
  quote: 30,
  quoteMark: 40,
  headline: 34,
  number: 26,
} as const;
/** Translucent tints used only on cards (the brand palette has no alpha variants). */
export const cardColors = {
  ring: 'rgba(169,179,252,0.28)',
  ringStrong: 'rgba(169,179,252,0.4)',
  inkRing: 'rgba(5,7,16,0.45)',
  inkRingDim: 'rgba(5,7,16,0.35)',
  inkTrack: 'rgba(5,7,16,0.25)',
  shadow: 'rgba(5,7,16,0.35)',
  star: '#CED8FC',
} as const;
export const cardSpace = {
  gutter: 24,
  top: 24,
  bottom: 18,
  row: 9,
  tight: 2,
  section: 18,
  divider: 14,
  recap: 22,
  recapBottom: 26,
} as const;
export const cardLine = { title: 20, headline: 35, claim: 17 } as const;

export type OrbitFavorite = {
  id: string;
  title: string;
  artistName: string;
  artworkUrl: string;
  /** The sharer's own rating, if any. */
  halfStars: number | null;
  review: string;
};

export const ORBIT_CENTER = { x: 180, y: 194 } as const;
export const ORBIT_RINGS = [
  { radius: 80, dashed: false },
  { radius: 110, dashed: true },
  { radius: 140, dashed: false },
] as const;
export const MOON_SIZE = 58;
/** Ring index and angle (degrees) for each favorite, in favorite order. */
const MOON_SLOTS = [
  { ring: 2, angle: -122 },
  { ring: 0, angle: -28 },
  { ring: 1, angle: 152 },
  { ring: 2, angle: 38 },
] as const;

export function moonPositions(count: number) {
  return MOON_SLOTS.slice(0, Math.max(0, Math.min(count, MOON_SLOTS.length))).map((slot) => {
    const a = (slot.angle * Math.PI) / 180,
      r = ORBIT_RINGS[slot.ring].radius;
    return {
      left: Math.round(ORBIT_CENTER.x + Math.cos(a) * r - MOON_SIZE / 2),
      top: Math.round(ORBIT_CENTER.y + Math.sin(a) * r - MOON_SIZE / 2),
    };
  });
}

/** Fixed star coordinates so a card renders identically every time: [x, y, radius, opacity]. */
export const STAR_FIELD: readonly (readonly [number, number, number, number])[] = [
  [22, 92, 1, 0.5],
  [64, 140, 0.8, 0.35],
  [318, 96, 1.2, 0.6],
  [340, 168, 0.8, 0.3],
  [28, 300, 1, 0.4],
  [334, 290, 0.9, 0.45],
  [96, 70, 0.7, 0.3],
  [262, 64, 0.9, 0.4],
  [150, 52, 0.6, 0.3],
  [44, 220, 0.7, 0.35],
  [330, 318, 1, 0.4],
  [22, 322, 0.8, 0.3],
  [244, 330, 0.7, 0.25],
  [108, 328, 0.9, 0.3],
  [298, 222, 0.6, 0.3],
  [70, 248, 0.6, 0.3],
  [236, 120, 0.6, 0.25],
  [110, 112, 0.6, 0.25],
];

/** The website hero's sound-wave field: stacked lines that bulge toward the middle. */
export function wavePaths({
  top,
  lines = 5,
  spacing = 6,
}: {
  top: number;
  lines?: number;
  spacing?: number;
}) {
  return Array.from({ length: lines }, (_, i) => {
    let d = '';
    for (let x = 0; x <= CARD.width; x += 6) {
      const t = x / CARD.width,
        bulge = Math.sin(Math.PI * t),
        amp = (6 + 3 * Math.sin(t * 3 + i * 0.3)) * bulge,
        y =
          top +
          i * spacing +
          Math.sin(x * 0.035 + i * 0.55) * amp +
          Math.sin(x * 0.08 - i * 0.3) * amp * 0.3;
      d += `${x === 0 ? 'M' : ' L'}${x} ${y.toFixed(1)}`;
    }
    return { d, opacity: Math.max(0.12, 0.5 - i * 0.07) };
  });
}

/** Logo geometry (viewBox 0 0 140 112): lower half-planet, waveform cut, horizon with a pulse. */
export const PLANET_PATHS = {
  planet: 'M16 46 A54 54 0 0 0 124 46 Z',
  cut: 'M16 66 C30 66 34 86 46 86 C58 86 62 50 70 50 C78 50 82 86 94 86 C106 86 110 66 124 66',
  horizon: 'M4 38 H56 C61 38 63 12 70 12 C77 12 79 38 84 38 H136',
  star: 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z',
} as const;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const monthStamp = (date: Date) => `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
export const startOfMonth = (date: Date, offset = 0) =>
  new Date(date.getFullYear(), date.getMonth() + offset, 1);

export function favoriteAverage(halfStars: number[]) {
  if (!halfStars.length) return null;
  return (halfStars.reduce((n, h) => n + h, 0) / halfStars.length / 2).toFixed(1);
}

export type RecapSave = { trackId: string; savedAtMillis: number; saveCountAtSave: number };
/** The month's earliest find: the save made when the track had the fewest saves. */
export function pickRecap(saves: RecapSave[], now: Date) {
  for (const offset of [0, -1]) {
    const from = startOfMonth(now, offset).getTime(),
      to = startOfMonth(now, offset + 1).getTime();
    const inMonth = saves.filter((s) => s.savedAtMillis >= from && s.savedAtMillis < to);
    if (!inMonth.length) continue;
    const best = [...inMonth].sort(
      (a, b) => a.saveCountAtSave - b.saveCountAtSave || a.savedAtMillis - b.savedAtMillis,
    )[0];
    const month = startOfMonth(now, offset);
    return {
      save: best,
      monthLabel: `YOUR ${MONTH_NAMES[month.getMonth()].toUpperCase()}`,
      foundAt: best.saveCountAtSave,
    };
  }
  return null;
}

export const savesLabel = (n: number) => `${n} ${n === 1 ? 'save' : 'saves'}`;
export function initials(name: string) {
  const words = name
    .replace(/^@/, '')
    .split(/[\s_.-]+/)
    .filter(Boolean);
  const letters =
    words.length > 1
      ? words
          .slice(0, 2)
          .map((w) => w[0])
          .join('')
      : (words[0] || 'ew').slice(0, 2);
  return letters.toUpperCase();
}
