import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, fontFamily, fontSize, radius, tracking } from '../../shared/theme';
import { Artwork } from './Artwork';
import { welcomeArtwork } from './welcome-artwork';

// Geometry is in a 390-point canvas; all radii and images scale together on smaller screens.
const rings = [
  { radius: 113, duration: 48000, direction: 1, items: [0, 1], angles: [-55, 125] },
  { radius: 178, duration: 68000, direction: -1, items: [2, 3, 4], angles: [-115, 5, 125] },
  { radius: 239, duration: 90000, direction: 1, items: [5, 6, 7], angles: [-70, 50, 170] },
] as const;

function OrbitArtwork({
  index,
  angle,
  distance,
  scale,
  direction,
  progress,
}: {
  index: number;
  angle: number;
  distance: number;
  scale: number;
  direction: number;
  progress: SharedValue<number>;
}) {
  const item = welcomeArtwork[index];
  const size = 62 * scale;
  const motion = useAnimatedStyle(() => {
    const theta = (angle * Math.PI) / 180 + progress.value * Math.PI * 2 * direction;
    return {
      transform: [
        { translateX: Math.cos(theta) * distance },
        { translateY: Math.sin(theta) * distance },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.artwork,
        {
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          borderRadius: radius.pill,
        },
        motion,
      ]}
    >
      <Artwork uri={item.uri} name={item.name} size="fill" />
    </Animated.View>
  );
}

function OrbitRing({
  ring,
  scale,
  running,
}: {
  ring: (typeof rings)[number];
  scale: number;
  running: boolean;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (running) {
      // The live accessibility preference is already part of running; avoid a stale startup preference.
      // A full turn ends at the same position, so repeat and resume have no visible jump.
      progress.value = withRepeat(
        withTiming(progress.value + 1, {
          duration: ring.duration,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        }),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      );
    }
    return () => cancelAnimation(progress);
  }, [running, ring.duration, progress]);
  const distance = ring.radius * scale;
  return (
    <View style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.ring,
          {
            width: distance * 2,
            height: distance * 2,
            marginLeft: -distance,
            marginTop: -distance,
            borderColor: ring.direction === -1 ? colors.accent + '55' : colors.line,
          },
        ]}
      />
      {ring.items.map((index, position) => (
        <OrbitArtwork
          key={index}
          index={index}
          angle={ring.angles[position]}
          distance={distance}
          scale={scale}
          direction={ring.direction}
          progress={progress}
        />
      ))}
    </View>
  );
}

export function WelcomeOrbit({ width, height }: { width: number; height: number }) {
  const systemReduceMotion = useReducedMotion();
  const [reduceMotion, setReduceMotion] = useState(systemReduceMotion);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const app = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    // Reanimated's initial setting is synchronous; also catch changes since app launch.
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => {
        /* Keep the synchronous system preference if the native query fails. */
      });
    return () => {
      mounted = false;
      app.remove();
      motion.remove();
    };
  }, []);
  const scale = Math.min(width / 390, height / 490, 1.2);
  const running = active && focused && !reduceMotion;
  return (
    <View style={[styles.scene, { width, height }]}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        <View
          style={[
            styles.halo,
            {
              width: 188 * scale,
              height: 188 * scale,
              marginLeft: -94 * scale,
              marginTop: -94 * scale,
            },
          ]}
        />
        {rings.map((ring) => (
          <OrbitRing key={ring.radius} ring={ring} scale={scale} running={running} />
        ))}
      </View>
      <View pointerEvents="none" style={styles.center}>
        <Text
          accessibilityRole="header"
          style={[styles.wordmark, { fontSize: fontSize.brandCompact * scale }]}
        >
          earlyworld
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { overflow: 'hidden', alignSelf: 'center' },
  ring: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  halo: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    borderRadius: radius.pill,
    backgroundColor: colors.panel,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 65, spreadDistance: 15, color: colors.panel },
    ],
  },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  wordmark: {
    color: colors.text,
    fontFamily: fontFamily.displayBold,
    letterSpacing: tracking.brand,
  },
  artwork: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.bg,
    backgroundColor: colors.artworkBg,
  },
});
