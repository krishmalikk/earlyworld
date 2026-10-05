import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { fontSize, fontWeight, radius, space } from '../../shared/theme';
import type { Track } from '../data/types';
import { useRatings } from '../data/ratings';
import { Artwork, c, s } from './ui';
import { TrackRow } from './TrackRow';
import { CommunityRating, Stars } from './RatingDisplay';

/** A small, bounded shelf; the main catalog/feed remains virtualized. */
export function TrackShelf({ tracks, compact = false }: { tracks: Track[]; compact?: boolean }) {
  const { byTrack } = useRatings();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.shelf}
    >
      {tracks.map((track) => {
        const rating = byTrack.get(track.id);
        if (!compact)
          return (
            <View key={track.id} style={{ width: 260 }}>
              <TrackRow track={track} variant="feature" />
            </View>
          );
        return (
          <Pressable
            key={track.id}
            accessibilityRole="button"
            accessibilityLabel={`${track.title} by ${track.artistName}`}
            onPress={() => router.push(`/track/${track.id}`)}
            style={({ pressed }) => [
              styles.card,
              compact && styles.compact,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.cover}>
              <Artwork uri={track.artworkUrl} name={track.title} size={compact ? 52 : 'fill'} />
            </View>
            <View style={styles.details}>
              <Text numberOfLines={2} style={[s.text, styles.title]}>
                {track.title}
              </Text>
              <Text numberOfLines={1} style={s.muted}>
                {track.artistName}
              </Text>
              {!compact && track.producerName ? (
                <Text numberOfLines={1} style={s.link}>
                  prod. {track.producerName}
                </Text>
              ) : null}
              {rating ? (
                <View style={s.row}>
                  <Stars value={rating.halfStars} size={12} />
                  <Text style={s.muted}>You</Text>
                </View>
              ) : (
                <CommunityRating track={track} />
              )}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  shelf: { gap: space[12], paddingBottom: space[4] },
  card: {
    width: 236,
    padding: space[12],
    gap: space[12],
    borderRadius: radius.card,
    backgroundColor: c.panel,
  },
  compact: { width: 242, flexDirection: 'row', alignItems: 'center' },
  cover: { overflow: 'hidden', borderRadius: radius.large },
  details: { gap: space[5], flex: 1 },
  title: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
});
