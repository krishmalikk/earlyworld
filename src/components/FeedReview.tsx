import { fontSize, fontWeight, lineHeight, radius, space } from '../../shared/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCatalogIds } from '../data/catalog';
import { useCommunity } from '../data/community';
import type { Rating, ReleaseRating, User } from '../data/types';
import { Stars } from './RatingDisplay';
import { Artwork, c } from './ui';

/**
 * A review in the feed: the music first, then the stars, the words and who wrote them.
 * `tile` is the fixed-width version for the horizontal "Reviews for you" row.
 */
export function FeedReview({
  rating,
  reason,
  tile = false,
}: {
  rating: Rating | ReleaseRating;
  reason?: string;
  tile?: boolean;
}) {
  const release = 'releaseId' in rating;
  const itemId = release ? rating.releaseId : rating.trackId;
  const catalog = useCatalogIds(release ? 'releases' : 'tracks', [itemId]);
  const item = catalog.byId.get(itemId);
  const author = useCommunity<User>({ kind: 'profile', uid: rating.uid }).data[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${author?.username || 'A listener'} rated ${item?.title || 'this'} ${rating.halfStars / 2} stars`}
      onPress={() => router.push(release ? `/release/${itemId}` : `/track/${itemId}`)}
      style={({ pressed }) => [styles.card, tile && styles.tile, { opacity: pressed ? 0.85 : 1 }]}
    >
      {reason ? (
        <View style={styles.reason}>
          <Ionicons name="sparkles" size={11} color={c.accent} />
          <Text numberOfLines={1} style={styles.reasonText}>
            {reason}
          </Text>
        </View>
      ) : null}
      <View style={styles.music}>
        <View style={styles.art}>
          <Artwork uri={item?.artworkUrl} name={item?.title || '—'} size={48} />
        </View>
        <View style={{ flex: 1, gap: space[2] }}>
          <Text numberOfLines={1} style={styles.title}>
            {item?.title || ' '}
          </Text>
          <Text numberOfLines={1} style={styles.muted}>
            {item?.artistName || ' '}
            {release ? ' · release' : ''}
          </Text>
        </View>
      </View>
      <View style={styles.score}>
        <Stars value={rating.halfStars} size={14} />
        <Text style={styles.scoreText}>{(rating.halfStars / 2).toFixed(1)}</Text>
      </View>
      {rating.review ? (
        <Text numberOfLines={tile ? 4 : 6} style={styles.review}>
          {rating.review}
        </Text>
      ) : null}
      <Text numberOfLines={1} style={[styles.muted, tile && { marginTop: 'auto' }]}>
        {author?.username ? `@${author.username}` : ' '}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: c.panel, borderRadius: radius.card, padding: space[16], gap: space[10] },
  tile: { width: 272, minHeight: 236 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space[5] },
  reasonText: { flex: 1, color: c.accent, fontSize: fontSize.smallLabel },
  music: { flexDirection: 'row', alignItems: 'center', gap: space[12] },
  art: { borderRadius: radius.medium, overflow: 'hidden' },
  title: { color: c.text, fontSize: fontSize.body, fontWeight: fontWeight.bold },
  muted: { color: c.muted, fontSize: fontSize.label },
  score: { flexDirection: 'row', alignItems: 'center', gap: space[6] },
  scoreText: { color: c.accent, fontSize: fontSize.label, fontWeight: fontWeight.bold },
  review: { color: c.text, fontSize: fontSize.body, lineHeight: lineHeight.content },
});
