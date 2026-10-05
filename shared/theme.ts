/** Design scales preserve the current navy/lavender layout; change shared values here. */
export { colors, tierColors } from './brand';

export const space = {
  0: 0,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  12: 12,
  14: 14,
  15: 15,
  16: 16,
  18: 18,
  20: 20,
  22: 22,
  24: 24,
  28: 28,
  30: 30,
  40: 40,
} as const;
export const fontSize = {
  micro: 8,
  smallCaption: 9,
  caption: 10,
  smallLabel: 11,
  label: 12,
  navigation: 13,
  body: 14,
  trackTitle: 16,
  section: 19,
  brandCompact: 21,
  studio: 27,
  title: 29,
  brandLoading: 30,
  onboarding: 33,
  brandHero: 40,
} as const;
export const lineHeight = {
  micro: 14,
  caption: 15,
  label: 17,
  body: 18,
  content: 20,
  reading: 24,
} as const;
export const fontWeight = { regular: '400', medium: '600', bold: '700', heavy: '800' } as const;
export const fontFamily = {
  mono: 'monospace',
  display: 'Panchang-Medium',
  displayBold: 'Panchang-Bold',
  displayRegular: 'Panchang-Regular',
} as const;
export const tracking = {
  title: -1.2,
  studio: -1,
  brand: -0.8,
  brandHero: -2,
  eyebrow: 0.5,
  button: 0.6,
  metadata: 0.7,
  micro: 0.8,
  badge: 0.9,
  mono: 1.6,
} as const;
export const radius = { small: 3, medium: 8, large: 12, card: 20, pill: 999 } as const;
export const imageDefaults = {
  cachePolicy: 'memory-disk',
  contentFit: 'cover',
  transition: 120,
} as const;
