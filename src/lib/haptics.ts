import { Platform } from 'react-native';
type HapticsModule = typeof import('expo-haptics');
let haptics: HapticsModule | null | undefined;
// Loaded lazily: a development client built before expo-haptics has no native module,
// and importing it at startup would crash the app. Without the module, taps are silent.
function load(): HapticsModule | null {
  if (haptics !== undefined) return haptics;
  try {
    haptics = Platform.OS === 'web' ? null : (require('expo-haptics') as HapticsModule);
  } catch {
    haptics = null;
  }
  return haptics;
}
const quiet = (work: Promise<void> | undefined) => void work?.catch(() => undefined);
/** A light tick for a selection change: a half-star step, a chip. */
export const tick = () => quiet(load()?.selectionAsync());
/** A soft tap for a completed action: a save, a like, a follow. */
export const tap = () => {
  const module = load();
  quiet(module?.impactAsync(module.ImpactFeedbackStyle.Light));
};
