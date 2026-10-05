import { fontWeight, radius, space } from '../../shared/theme';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Rating } from '../data/types';
import { useCatalogIds } from '../data/catalog';
import { Stars } from './RatingDisplay';
import { s } from './ui';
import { Artwork } from './Artwork';
export function HighestRated({ ratings }: { ratings: Rating[] }) {
  const catalog = useCatalogIds(
    'tracks',
    ratings.map((r) => r.trackId),
  );
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space[14] }}
    >
      {ratings.map((rating) => {
        const track = catalog.byId.get(rating.trackId);
        return (
          <Pressable
            key={rating.id}
            disabled={!track}
            accessibilityRole="button"
            accessibilityLabel={`${track?.title || 'Track unavailable'}, ${rating.halfStars / 2} out of 5 stars`}
            onPress={() => router.push(`/track/${rating.trackId}`)}
            style={{ width: 146, gap: space[7] }}
          >
            <View style={{ borderRadius: radius.large, overflow: 'hidden' }}>
              <Artwork
                uri={track?.artworkUrl}
                name={track?.title || 'Track unavailable'}
                size="fill"
              />
            </View>
            <Stars value={rating.halfStars} />
            <Text numberOfLines={2} style={[s.text, { fontWeight: fontWeight.medium }]}>
              {track?.title || 'Track unavailable'}
            </Text>
            {track ? (
              <Text numberOfLines={1} style={s.muted}>
                {track.artistName}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
