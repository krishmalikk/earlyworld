import { fontFamily, fontSize, fontWeight, radius, space, tracking } from '../../shared/theme';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import type { Track } from '../data/types';
import { Artwork, c } from './ui';

const GAP = space[12];
// How much of the next card shows at the right edge.
const PEEK = space[40];

/** Paging cover cards for the top of the feed; the first card is the most-saved track. */
export function FeedCarousel({ tracks }: { tracks: Track[] }) {
  const { width } = useWindowDimensions();
  const cardWidth = width - space[18] * 2 - PEEK;
  const [index, setIndex] = useState(0);
  const sorted = [...tracks].sort((a, b) => (b.saveCount ?? 0) - (a.saveCount ?? 0));
  return (
    <View style={{ gap: space[14] }}>
      <FlatList
        horizontal
        data={sorted}
        keyExtractor={(track) => track.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + GAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: space[18], gap: GAP }}
        style={{ marginHorizontal: -space[18] }}
        onScroll={(e) =>
          setIndex(
            Math.min(
              sorted.length - 1,
              Math.max(0, Math.round(e.nativeEvent.contentOffset.x / (cardWidth + GAP))),
            ),
          )
        }
        scrollEventThrottle={32}
        renderItem={({ item, index: i }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.title} by ${item.artistName}`}
            onPress={() => router.push(`/track/${item.id}`)}
            style={({ pressed }) => [
              styles.card,
              { width: cardWidth, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={styles.cover}>
              <Artwork uri={item.artworkUrl} name={item.title} size="fill" />
            </View>
            <View style={styles.body}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{i === 0 ? 'Most saved' : 'On your radar'}</Text>
              </View>
              <Text numberOfLines={1} style={styles.title}>
                {item.title}
              </Text>
              <Text numberOfLines={1} style={styles.meta}>
                {item.artistName}
                {item.producerName ? (
                  <>
                    {' · prod. '}
                    <Text style={{ color: c.accent }}>{item.producerName}</Text>
                  </>
                ) : null}
              </Text>
            </View>
          </Pressable>
        )}
      />
      {sorted.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden>
          {sorted.map((track, i) => (
            <View key={track.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: c.panel, borderRadius: radius.card, overflow: 'hidden' },
  cover: { height: 168, overflow: 'hidden', justifyContent: 'center' },
  body: { padding: space[16], gap: space[8] },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: c.accent,
    borderRadius: radius.small,
    paddingHorizontal: space[8],
    paddingVertical: space[3],
  },
  tagText: {
    color: c.bg,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.smallLabel,
    letterSpacing: tracking.mono,
    textTransform: 'uppercase',
  },
  title: {
    color: c.text,
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.brandCompact,
    fontWeight: fontWeight.regular,
    letterSpacing: tracking.brand,
  },
  meta: { color: c.muted, fontSize: fontSize.body },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space[6] },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: c.line },
  dotActive: { width: 18, backgroundColor: c.accent },
});
