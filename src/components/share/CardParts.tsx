import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, fontFamily, fontWeight, radius, tracking } from '../../../shared/theme';
import { artworkSources } from '../../../shared/artwork';
import {
  CARD,
  PLANET_PATHS,
  STAR_FIELD,
  cardColors,
  cardSpace,
  cardType,
  initials,
  wavePaths,
} from '../../../shared/share-cards';

/** The logo's planet: lower half-sphere, a waveform cut, and the horizon pulse. */
export function PlanetMark({
  width,
  fill = colors.text,
  cut = colors.bg,
  horizon = colors.text,
  shade,
}: {
  width: number;
  fill?: string;
  cut?: string;
  horizon?: string;
  /** Gradient end color for the large planet; small marks stay flat. */
  shade?: string;
}) {
  const stroke = width < 40 ? 8 : 6;
  return (
    <Svg width={width} height={(width * 112) / 140} viewBox="0 0 140 112" accessible={false}>
      {shade ? (
        <Defs>
          <LinearGradient id="planetShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fill} />
            <Stop offset="1" stopColor={shade} />
          </LinearGradient>
        </Defs>
      ) : null}
      <Path d={PLANET_PATHS.planet} fill={shade ? 'url(#planetShade)' : fill} />
      <Path
        d={PLANET_PATHS.cut}
        fill="none"
        stroke={cut}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <Path
        d={PLANET_PATHS.horizon}
        fill="none"
        stroke={horizon}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Faint stars and the sound-wave field, drawn behind card content. */
export function Backdrop({ waveTop, accent }: { waveTop?: number; accent: string }) {
  return (
    <Svg
      width={CARD.width}
      height={CARD.height}
      style={StyleSheet.absoluteFill}
      accessible={false}
      pointerEvents="none"
    >
      {STAR_FIELD.map(([x, y, r, o]) => (
        <Circle key={`${x}:${y}`} cx={x} cy={y} r={r} fill={cardColors.star} opacity={o} />
      ))}
      {waveTop !== undefined
        ? wavePaths({ top: waveTop }).map((w, i) => (
            <Path
              key={i}
              d={w.d}
              fill="none"
              stroke={accent}
              strokeWidth={1.1}
              strokeLinecap="round"
              opacity={w.opacity}
            />
          ))
        : null}
    </Svg>
  );
}

export function CardHeader({
  label,
  ink = colors.text,
  muted = colors.muted,
}: {
  label: string;
  ink?: string;
  muted?: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <PlanetMark
          width={24}
          fill={ink}
          horizon={ink}
          cut={ink === colors.text ? colors.bg : colors.accent}
        />
        <Text style={[styles.wordmark, { color: ink }]}>earlyworld</Text>
      </View>
      <Text style={[styles.mono, { color: muted }]}>{label}</Text>
    </View>
  );
}

/** Round artwork that reports when it has painted (or failed), so capture never waits forever. */
export function Moon({
  uri,
  name,
  size,
  border,
  borderWidth = 2,
  onReady,
  style,
}: {
  uri?: string | null;
  name: string;
  size: number;
  border: string;
  borderWidth?: number;
  onReady: () => void;
  style?: ViewStyle;
}) {
  // Exported at 3×, so request the matching resolution.
  const source = artworkSources(uri, size * 3)[0];
  const [failed, setFailed] = useState(!source);
  // Initials need no loading, so a missing URL is ready at once.
  useEffect(() => {
    if (!source) onReady();
  }, [source]);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
          borderWidth,
          borderColor: border,
          overflow: 'hidden',
          backgroundColor: colors.artworkBg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {failed ? (
        <Text style={[styles.initials, { color: border }]}>{initials(name)}</Text>
      ) : (
        <Image
          source={{ uri: source }}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={0}
          style={StyleSheet.absoluteFill}
          onLoad={onReady}
          onError={() => {
            setFailed(true);
            onReady();
          }}
        />
      )}
    </View>
  );
}

export function StarRow({
  halfStars,
  size,
  color,
}: {
  halfStars: number;
  size: number;
  color: string;
}) {
  return (
    <View style={styles.stars} accessible accessibilityLabel={`${halfStars / 2} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = halfStars >= n * 2 ? 1 : halfStars === n * 2 - 1 ? 0.5 : 0;
        return (
          <View key={n} style={{ width: size, height: size }}>
            <Svg width={size} height={size} viewBox="0 0 24 24" style={StyleSheet.absoluteFill}>
              <Path d={PLANET_PATHS.star} fill={color} opacity={0.22} />
            </Svg>
            {fill ? (
              <View style={{ width: size * fill, height: size, overflow: 'hidden' }}>
                <Svg width={size} height={size} viewBox="0 0 24 24">
                  <Path d={PLANET_PATHS.star} fill={color} />
                </Svg>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export const cardText = StyleSheet.create({
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: cardType.mono,
    letterSpacing: tracking.mono,
  },
  display: { fontFamily: fontFamily.displayBold },
  body: { color: colors.text, fontSize: cardType.body },
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: cardSpace.row - 2 },
  wordmark: {
    fontFamily: fontFamily.displayBold,
    fontSize: cardType.wordmark,
    letterSpacing: tracking.eyebrow,
  },
  mono: { fontFamily: fontFamily.mono, fontSize: cardType.mono, letterSpacing: tracking.mono },
  initials: {
    fontFamily: fontFamily.monoMedium,
    fontSize: cardType.body,
    fontWeight: fontWeight.medium,
  },
  stars: { flexDirection: 'row', gap: cardSpace.tight * 2 },
});
