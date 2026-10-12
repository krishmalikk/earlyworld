import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fontFamily, fontWeight, radius, tracking } from '../../../shared/theme';
import {
  CARD,
  MOON_SIZE,
  ORBIT_CENTER,
  ORBIT_RINGS,
  PLANET_PATHS,
  cardColors,
  cardSpace,
  cardType,
  moonPositions,
  type OrbitFavorite,
} from '../../../shared/share-cards';
import { Backdrop, CardHeader, Moon, PlanetMark, cardText } from './CardParts';

export type OrbitCardProps = {
  username: string;
  scenes: string[];
  favorites: OrbitFavorite[];
  saves: number;
  reviews: number;
  average: string | null;
  stamp: string;
  accent?: string;
  onReady: (id: string) => void;
};

/** Favorites orbiting the listener's planet, each with their rating and review. */
export const OrbitCard = forwardRef<View, OrbitCardProps>(function OrbitCard(
  { username, scenes, favorites, saves, reviews, average, stamp, accent = colors.accent, onReady },
  ref,
) {
  const moons = moonPositions(favorites.length);
  const planetWidth = 130;
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <Backdrop waveTop={552} accent={accent} />
      <View style={styles.top}>
        <CardHeader label="MY ORBIT" />
      </View>
      {ORBIT_RINGS.map((ring) => (
        <View
          key={ring.radius}
          style={{
            position: 'absolute',
            left: ORBIT_CENTER.x - ring.radius,
            top: ORBIT_CENTER.y - ring.radius,
            width: ring.radius * 2,
            height: ring.radius * 2,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderStyle: ring.dashed ? 'dashed' : 'solid',
            borderColor: cardColors.ring,
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: ORBIT_CENTER.x - planetWidth / 2,
          top: ORBIT_CENTER.y - 54,
        }}
      >
        <PlanetMark width={planetWidth} fill={colors.text} shade={accent} horizon={colors.text} />
      </View>
      {favorites.map((f, i) => (
        <View key={f.id} style={{ position: 'absolute', left: moons[i].left, top: moons[i].top }}>
          <Moon
            uri={f.artworkUrl}
            name={f.title}
            size={MOON_SIZE}
            border={accent}
            onReady={() => onReady(f.id)}
          />
          <View style={[styles.badge, { backgroundColor: accent }]}>
            <Text style={styles.badgeText}>{i + 1}</Text>
          </View>
        </View>
      ))}
      <View style={styles.legend}>
        <View style={styles.between}>
          <Text style={[cardText.display, styles.handle]} numberOfLines={1}>
            @{username}
          </Text>
          <Text style={[cardText.mono, styles.scenes, { color: accent }]} numberOfLines={1}>
            {scenes.slice(0, 2).join(' · ').toUpperCase()}
          </Text>
        </View>
        {favorites.map((f, i) => (
          <View key={f.id} style={styles.row}>
            <Text style={[cardText.mono, styles.index, { color: accent }]}>0{i + 1}</Text>
            <View style={styles.rowBody}>
              <View style={styles.between}>
                <Text style={styles.title} numberOfLines={1}>
                  <Text style={styles.strong}>{f.title}</Text>
                  <Text style={styles.muted}> · {f.artistName}</Text>
                </Text>
                {f.halfStars ? (
                  <View style={styles.rating}>
                    <Svg width={10} height={10} viewBox="0 0 24 24">
                      <Path d={PLANET_PATHS.star} fill={accent} />
                    </Svg>
                    <Text style={[cardText.mono, { color: accent }]}>
                      {(f.halfStars / 2).toFixed(1)}
                    </Text>
                  </View>
                ) : null}
              </View>
              {f.review ? (
                <Text style={styles.review} numberOfLines={1}>
                  “{f.review}”
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <View style={styles.stats}>
          {(
            [
              [String(saves), 'SAVES', colors.text],
              [String(reviews), 'REVIEWS', colors.text],
              ...(average ? [[average, 'AVG ★ FAVES', accent]] : []),
            ] as [string, string, string][]
          ).map(([value, label, color]) => (
            <View key={label} style={styles.stat}>
              <Text style={[cardText.display, styles.statValue, { color }]}>{value}</Text>
              <Text style={[cardText.mono, styles.statLabel]}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={[cardText.mono, styles.statLabel]}>{stamp}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: CARD.width, height: CARD.height, backgroundColor: colors.bg, overflow: 'hidden' },
  top: {
    position: 'absolute',
    left: cardSpace.gutter,
    right: cardSpace.gutter,
    top: cardSpace.top,
  },
  badge: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fontFamily.monoMedium, fontSize: cardType.mono, color: colors.bg },
  legend: {
    position: 'absolute',
    left: cardSpace.gutter,
    right: cardSpace.gutter,
    top: 352,
    gap: cardSpace.row,
  },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: cardSpace.row,
  },
  handle: { flexShrink: 1, color: colors.text, fontSize: cardType.handle },
  scenes: { fontSize: cardType.label, letterSpacing: tracking.badge },
  row: { flexDirection: 'row', gap: cardSpace.row + 1, alignItems: 'flex-start' },
  index: { width: 18, paddingTop: cardSpace.tight },
  rowBody: { flex: 1, minWidth: 0, gap: cardSpace.tight },
  title: { flex: 1, color: colors.text, fontSize: cardType.body },
  strong: { fontWeight: fontWeight.bold },
  muted: { color: colors.muted },
  rating: { flexDirection: 'row', alignItems: 'center', gap: cardSpace.tight + 1 },
  review: { color: colors.muted, fontSize: cardType.small, fontStyle: 'italic' },
  footer: {
    position: 'absolute',
    left: cardSpace.gutter,
    right: cardSpace.gutter,
    bottom: cardSpace.bottom,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  stats: { flexDirection: 'row', gap: cardSpace.gutter - 6 },
  stat: { gap: cardSpace.tight / 2 },
  statValue: { fontSize: cardType.stat },
  statLabel: { fontSize: cardType.micro, letterSpacing: tracking.badge, color: colors.muted },
});
