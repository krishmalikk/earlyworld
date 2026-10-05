import { space } from '../../shared/theme';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Track } from '../data/types';
import { averageRating, ratingLabel } from '../../shared/ratings';
import { c, s } from './ui';
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View
      accessible
      accessibilityLabel={value ? ratingLabel(value) : 'No rating selected'}
      style={{ flexDirection: 'row', gap: space[2] }}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={value >= star * 2 ? 'star' : value === star * 2 - 1 ? 'star-half' : 'star-outline'}
          size={size}
          color={c.accent}
        />
      ))}
    </View>
  );
}
export function CommunityRating({
  track,
}: {
  track: Pick<Track, 'ratingCount' | 'ratingHalfStarSum'>;
}) {
  const average = averageRating(track.ratingCount, track.ratingHalfStarSum);
  return (
    <Text style={s.muted}>
      {average
        ? `★ ${average} · ${track.ratingCount} ${track.ratingCount === 1 ? 'rating' : 'ratings'}`
        : 'No ratings yet'}
    </Text>
  );
}
