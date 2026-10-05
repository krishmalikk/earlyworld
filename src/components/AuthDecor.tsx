import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { colors, radius } from '../../shared/theme';

// Decorative, non-interactive background art for the auth screen. The wave
// background is static; the sign-in orbit animates (a sonar ping plus orbiting
// signal dots) and honors the reduce-motion accessibility preference.

/** Flowing contour lines that bulge toward the middle, optionally under a readability veil. */
export function WaveBackground({ veil = true }: { veil?: boolean }) {
  const { width, height } = useWindowDimensions();
  const lineCount = 22;
  const top = 20;
  const span = Math.max(height - top, 1);
  const samples = 48;
  const lines = Array.from({ length: lineCount }, (_, i) => {
    const t = i / (lineCount - 1);
    const bulge = Math.sin(Math.PI * t); // 0 at edges, 1 in the middle
    const y = top + span * t;
    const amplitude = 5 + 18 * bulge;
    const phase = i * 0.6;
    let d = '';
    for (let step = 0; step <= samples; step++) {
      const x = -20 + ((width + 40) * step) / samples;
      const yy = y + amplitude * Math.sin(0.016 * x + phase);
      d += `${step === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${yy.toFixed(1)} `;
    }
    return { d, opacity: 0.07 + 0.11 * bulge };
  });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      <Svg width={width} height={height}>
        {lines.map((line, i) => (
          <Path
            key={i}
            d={line.d}
            stroke={colors.accent}
            strokeOpacity={line.opacity}
            strokeWidth={1.25}
            fill="none"
          />
        ))}
      </Svg>
      {veil ? (
        <LinearGradient
          colors={[
            'rgba(5,7,16,0.1)',
            'rgba(5,7,16,0.22)',
            'rgba(5,7,16,0.58)',
            'rgba(5,7,16,0.72)',
            'rgba(5,7,16,0.86)',
          ]}
          locations={[0, 0.22, 0.48, 0.72, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}

/** Auth sign-up background: flowing waves under a readability veil. */
export function AuthWaves() {
  return <WaveBackground veil />;
}

// Geometry captured from the design on a 390-point canvas; scales with the screen.
const ORBIT_CANVAS = 390;
const ORBIT_CENTER = { x: 195, y: 225 };
const ORBIT_RINGS = [
  { diameter: 426, accent: false },
  { diameter: 282, accent: true },
  { diameter: 138, accent: false },
] as const;
const TWO_PI = Math.PI * 2;

// Signal dots that travel around each ring. radius/size are on the 390-pt canvas.
const ORBIT_GROUPS = [
  {
    radius: 213,
    duration: 30000,
    direction: 1,
    dots: [
      { angle: -55, size: 7, opacity: 1 },
      { angle: 80, size: 5, opacity: 0.7 },
      { angle: 205, size: 4, opacity: 0.5 },
    ],
  },
  {
    radius: 141,
    duration: 22000,
    direction: -1,
    dots: [
      { angle: 15, size: 6, opacity: 0.9 },
      { angle: 190, size: 4, opacity: 0.6 },
    ],
  },
  {
    radius: 69,
    duration: 16000,
    direction: 1,
    dots: [
      { angle: 120, size: 5, opacity: 0.85 },
      { angle: 300, size: 4, opacity: 0.6 },
    ],
  },
] as const;

function OrbitDot({
  progress,
  direction,
  baseAngle,
  orbitRadius,
  size,
  opacity,
  cx,
  cy,
}: {
  progress: SharedValue<number>;
  direction: number;
  baseAngle: number;
  orbitRadius: number;
  size: number;
  opacity: number;
  cx: number;
  cy: number;
}) {
  const style = useAnimatedStyle(() => {
    const theta = (baseAngle * Math.PI) / 180 + progress.value * TWO_PI * direction;
    return {
      transform: [
        { translateX: Math.cos(theta) * orbitRadius },
        { translateY: Math.sin(theta) * orbitRadius },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: cx,
          top: cy,
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          borderRadius: radius.pill,
          backgroundColor: colors.accent,
          opacity,
        },
        style,
      ]}
    />
  );
}

function OrbitGroup({
  group,
  scale,
  running,
  cx,
  cy,
}: {
  group: (typeof ORBIT_GROUPS)[number];
  scale: number;
  running: boolean;
  cx: number;
  cy: number;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (running) {
      progress.value = withRepeat(
        withTiming(1, {
          duration: group.duration,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        }),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      );
    } else {
      cancelAnimation(progress);
    }
    return () => cancelAnimation(progress);
  }, [running, group.duration, progress]);
  return (
    <>
      {group.dots.map((dot, i) => (
        <OrbitDot
          key={i}
          progress={progress}
          direction={group.direction}
          baseAngle={dot.angle}
          orbitRadius={group.radius * scale}
          size={dot.size * scale}
          opacity={dot.opacity}
          cx={cx}
          cy={cy}
        />
      ))}
    </>
  );
}

function PingRing({
  delay,
  diameter,
  running,
  cx,
  cy,
}: {
  delay: number;
  diameter: number;
  running: boolean;
  cx: number;
  cy: number;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (running) {
      progress.value = withDelay(
        delay,
        withRepeat(
          withTiming(1, {
            duration: 2800,
            easing: Easing.out(Easing.cubic),
            reduceMotion: ReduceMotion.Never,
          }),
          -1,
          false,
          undefined,
          ReduceMotion.Never,
        ),
      );
    } else {
      cancelAnimation(progress);
      progress.value = 0;
    }
    return () => cancelAnimation(progress);
  }, [running, delay, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: (1 - progress.value) * 0.45,
    transform: [{ scale: 0.12 + progress.value * 0.92 }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: cx - diameter / 2,
          top: cy - diameter / 2,
          width: diameter,
          height: diameter,
          borderRadius: radius.pill,
          borderWidth: 1.5,
          borderColor: colors.accent,
        },
        style,
      ]}
    />
  );
}

/** Concentric rings with a sonar ping and orbiting signal dots — the "returning listener" motif. */
export function ReturningOrbit() {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const running = !reduceMotion;
  const scale = width / ORBIT_CANVAS;
  const sceneHeight = 440 * scale;
  const cx = ORBIT_CENTER.x * scale;
  const cy = ORBIT_CENTER.y * scale;
  const coreSize = 6 * scale;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height: sceneHeight, overflow: 'hidden' }}
    >
      {ORBIT_RINGS.map((ring) => {
        const size = ring.diameter * scale;
        return (
          <View
            key={ring.diameter}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              left: cx - size / 2,
              top: cy - size / 2,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: ring.accent ? colors.accent + '55' : colors.line,
            }}
          />
        );
      })}
      <PingRing delay={0} diameter={ORBIT_RINGS[0].diameter * scale} running={running} cx={cx} cy={cy} />
      <PingRing
        delay={1400}
        diameter={ORBIT_RINGS[0].diameter * scale}
        running={running}
        cx={cx}
        cy={cy}
      />
      <View
        style={{
          position: 'absolute',
          left: cx - coreSize / 2,
          top: cy - coreSize / 2,
          width: coreSize,
          height: coreSize,
          borderRadius: radius.pill,
          backgroundColor: colors.accent,
          boxShadow: [
            { offsetX: 0, offsetY: 0, blurRadius: 12, spreadDistance: 2, color: colors.accent + '88' },
          ],
        }}
      />
      {ORBIT_GROUPS.map((group, i) => (
        <OrbitGroup key={i} group={group} scale={scale} running={running} cx={cx} cy={cy} />
      ))}
    </View>
  );
}
