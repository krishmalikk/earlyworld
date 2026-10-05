/** Representative pixels sampled from assets/brand/earlyworld-logo.png. See BRAND_COLORS.md. */
export const logoPalette = {
  midnight: '#050710',
  navy: '#0C1425',
  silver: '#FAFAFC',
  ice: '#CED8FC',
  lavender: '#A9B3FC',
  lilac: '#DDD9FD',
  steel: '#7283B2',
  mist: '#9EABD3',
} as const;

/** Shared app colors. */
export const colors = {
  bg: logoPalette.midnight,
  panel: logoPalette.navy,
  line: '#2B3652',
  text: logoPalette.silver,
  muted: logoPalette.mist,
  accent: logoPalette.lavender,
  highlight: logoPalette.lilac,
  artworkBg: '#18223A',
  selected: '#202A48',
  error: '#F6988F',
} as const;

// Certifications retain a warm gold distinction; the other metals use the logo's cool highlights.
export const tierColors = {
  gold: ['#2D2630', '#DECAA0'],
  platinum: ['#172033', logoPalette.silver],
  multiplatinum: [colors.selected, logoPalette.ice],
  diamond: ['#29253F', logoPalette.lilac],
} as const;
