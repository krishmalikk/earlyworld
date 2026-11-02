import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, fontFamily, fontSize, radius, space, tracking } from '../../shared/theme';

/** How far a pull fills the orbit, and the gap iOS holds open while refreshing. */
const FULL_PULL = 110;
const HELD = 64;
const RING = 46;
const DOTS = [
  { angle: -90, size: 7 },
  { angle: 30, size: 5 },
  { angle: 150, size: 4 },
] as const;

function Dot({
  angle,
  size,
  progress,
  spin,
}: {
  angle: number;
  size: number;
  progress: SharedValue<number>;
  spin: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    // Dots fan out from the planet as you pull, then circle it while the feed reloads.
    const theta = ((angle - 120 * (1 - progress.value)) * Math.PI) / 180 + spin.value * Math.PI * 2;
    const distance = (RING / 2) * progress.value;
    return {
      opacity: progress.value,
      transform: [
        { translateX: Math.cos(theta) * distance },
        { translateY: Math.sin(theta) * distance },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.dot,
        { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 },
        style,
      ]}
    />
  );
}

/**
 * Branded pull-to-refresh for iOS: sits behind the list in the gap a pull opens, and
 * replaces the system spinner (which only takes a colour). Decorative to screen readers;
 * RefreshControl still provides the accessible refresh state.
 */
export function OrbitRefresh({
  pull,
  refreshing,
}: {
  pull: SharedValue<number>;
  refreshing: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const spin = useSharedValue(0),
    holding = useSharedValue(0);
  useEffect(() => {
    holding.value = withTiming(refreshing ? 1 : 0, { duration: 180 });
    if (refreshing && !reduceMotion)
      spin.value = withRepeat(
        withTiming(spin.value + 1, {
          duration: 1400,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        }),
        -1,
        false,
      );
    else cancelAnimation(spin);
    return () => cancelAnimation(spin);
  }, [refreshing, reduceMotion, spin, holding]);
  const progress = useDerivedValue(() =>
    Math.max(holding.value, Math.min(1, pull.value / FULL_PULL)),
  );
  const area = useAnimatedStyle(() => ({
    height: Math.max(pull.value, HELD * holding.value),
  }));
  const ring = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.35, 1]) }],
  }));
  const planet = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.4, 1]) }],
    opacity: interpolate(progress.value, [0, 0.3], [0, 1], 'clamp'),
  }));
  const label = useAnimatedStyle(() => ({
    opacity: interpolate(pull.value, [FULL_PULL * 0.8, FULL_PULL * 1.3], [0, 1], 'clamp'),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.area, area]}
    >
      <Animated.View style={styles.orbit}>
        <Animated.View style={[styles.ring, ring]} />
        <Animated.View style={[styles.planet, planet]} />
        {DOTS.map((dot) => (
          <Dot key={dot.angle} {...dot} progress={progress} spin={spin} />
        ))}
      </Animated.View>
      <Animated.View style={label}>
        <Text style={styles.label}>{refreshing ? 'Tuning in…' : 'New finds incoming'}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  area: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[10],
  },
  orbit: { width: RING, height: RING },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  planet: {
    position: 'absolute',
    left: RING / 2 - 7,
    top: RING / 2 - 7,
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 10, spreadDistance: 1, color: colors.accent },
    ],
  },
  dot: {
    position: 'absolute',
    left: RING / 2,
    top: RING / 2,
    borderRadius: radius.pill,
    backgroundColor: colors.highlight,
  },
  label: {
    color: colors.muted,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    letterSpacing: tracking.mono,
    textTransform: 'uppercase',
  },
});
