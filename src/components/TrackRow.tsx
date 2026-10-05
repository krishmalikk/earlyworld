import { averageRating } from '../../shared/ratings';
import { fontSize, fontWeight, radius, space } from '../../shared/theme';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLocal } from '../state/local';
import { useRatings } from '../data/ratings';
import { Stars, CommunityRating } from './RatingDisplay';
import { useSaves } from '../data/saves';
import { errorMessage } from '../lib/firebase';
import { toggleSave } from '../data/actions';
import type { Track } from '../data/types';
import { Artwork, c, ErrorLine, s } from './ui';
export function SaveButton({
  track,
  onError,
  prominent = false,
}: {
  track: Track;
  onError?: (message: string | null) => void;
  prominent?: boolean;
}) {
  const uid = useLocal((x) => x.uid);
  const { ids, loading, error: saveError } = useSaves();
  const inFlight = useRef(false);
  const data = ids.has(track.id);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function save() {
    if (!uid || inFlight.current || loading) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    onError?.(null);
    try {
      await toggleSave(uid, track, !!data);
    } catch (e) {
      const message = `Could not ${data ? 'remove' : 'save'} this track. Check your connection and tap the bookmark to retry. ${errorMessage(e)}`;
      setError(message);
      onError?.(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={onError ? { width: 44, flexShrink: 0 } : { maxWidth: '100%' }}>
      <Pressable
        accessibilityLabel={data ? 'Unsave track' : 'Save track'}
        accessibilityRole="button"
        disabled={busy || loading || !!saveError || !uid}
        accessibilityState={{ busy, selected: data }}
        onPress={save}
        style={{
          minWidth: 44,
          borderRadius: radius.pill,
          backgroundColor: prominent ? c.accent : 'transparent',
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: busy ? 0.4 : 1,
        }}
      >
        <Ionicons
          name={data ? 'bookmark' : 'bookmark-outline'}
          size={20}
          color={prominent ? c.bg : data ? c.accent : c.muted}
        />
      </Pressable>
      {!onError ? <ErrorLine message={error || saveError} /> : null}
    </View>
  );
}
export const platformNames = {
  soundcloud: 'SoundCloud',
  youtube: 'YouTube',
  bandcamp: 'Bandcamp',
  other: 'Original release',
} as const;

export function TrackRow({
  track,
  showOwnRating = true,
  variant = 'row',
}: {
  track: Track;
  showOwnRating?: boolean;
  variant?: 'row' | 'card' | 'embedded' | 'feature';
}) {
  const { byTrack } = useRatings();
  const rating = showOwnRating ? byTrack.get(track.id) : undefined;
  const [saveError, setSaveError] = useState<string | null>(null);
  const card = variant === 'feature';
  const embedded = variant === 'embedded';
  if (!card && !embedded) {
    const average = averageRating(track.ratingCount, track.ratingHalfStarSum);
    return (
      <View style={styles.compactCard}>
        <View style={styles.compactContent}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${track.title} by ${track.artistName}${track.producerName ? `, produced by ${track.producerName}` : ''}`}
            onPress={() => router.push(`/track/${track.id}`)}
            style={({ pressed }) => [styles.compactIdentity, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={styles.cover}>
              <Artwork uri={track.artworkUrl} name={track.title} size={52} />
            </View>
            <View style={styles.compactDetails}>
              <Text numberOfLines={2} style={[s.text, styles.title]}>
                {track.title}
              </Text>
              <Text numberOfLines={1} style={s.muted}>
                {track.artistName}
              </Text>
              {track.producerName ? (
                <Text numberOfLines={1} style={styles.compactProducer}>
                  prod. {track.producerName}
                </Text>
              ) : null}
              <Text numberOfLines={1} style={styles.compactMetadata}>
                {platformNames[track.sourcePlatform]} · {track.saveCount ?? 0}{' '}
                {track.saveCount === 1 ? 'save' : 'saves'}
              </Text>
              {rating ? (
                <View style={[s.row, { gap: space[5] }]}>
                  <Text style={styles.compactMetadata}>You</Text>
                  <Stars value={rating.halfStars} size={10} />
                </View>
              ) : null}
            </View>
          </Pressable>
          <View style={styles.compactActions}>
            {average ? (
              <View
                accessible
                accessibilityLabel={`${average} stars, ${track.ratingCount} ratings`}
                style={styles.compactScore}
              >
                <Text style={styles.score}>★ {average}</Text>
                <Text style={styles.compactMetadata}>
                  {track.ratingCount} {track.ratingCount === 1 ? 'rating' : 'ratings'}
                </Text>
              </View>
            ) : (
              <Text style={styles.unrated}>No ratings yet</Text>
            )}
            <SaveButton track={track} onError={setSaveError} />
          </View>
        </View>
        <ErrorLine message={saveError} />
      </View>
    );
  }
  return (
    <View style={embedded ? styles.embedded : styles.card}>
      <View style={[s.row, { gap: space[4] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${track.title} by ${track.artistName}${track.producerName ? `, produced by ${track.producerName}` : ''}`}
          onPress={() => router.push(`/track/${track.id}`)}
          style={({ pressed }) => [
            styles.identity,
            card && styles.cardIdentity,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <View style={[styles.cover, card && { width: '100%' }]}>
            <Artwork uri={track.artworkUrl} name={track.title} size={card ? 'fill' : 72} />
            {card ? (
              <View style={styles.artLabel}>
                <Text style={styles.artLabelText}>
                  {platformNames[track.sourcePlatform]}
                  {track.durationSeconds
                    ? ` · ${Math.floor(track.durationSeconds / 60)}:${String(Math.floor(track.durationSeconds % 60)).padStart(2, '0')}`
                    : ''}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.details, card && { width: '100%' }]}>
            {card && track.producerName ? (
              <Text numberOfLines={1} style={styles.producerTag}>
                PROD. {track.producerName}
              </Text>
            ) : null}
            <Text numberOfLines={2} style={[s.text, styles.title, card && styles.cardTitle]}>
              {track.title}
            </Text>
            <Text numberOfLines={1} style={card ? s.text : s.muted}>
              {track.artistName}
            </Text>
            {!card && track.producerName ? (
              <Text numberOfLines={2} style={s.link}>
                prod. {track.producerName}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </View>
      {!embedded ? (
        <View style={styles.cardFooter}>
          <View style={styles.details}>
            <View style={styles.ratings}>
              <CommunityRating track={track} />
              {rating ? (
                <View style={[s.row, { gap: space[6] }]}>
                  <Text style={[s.muted, { fontSize: fontSize.caption }]}>You</Text>
                  <Stars value={rating.halfStars} size={11} />
                </View>
              ) : null}
            </View>
            <Text style={styles.metadata}>
              {track.saveCount} {track.saveCount === 1 ? 'save' : 'saves'} ·{' '}
              {platformNames[track.sourcePlatform]}
            </Text>
          </View>
          {card ? <SaveButton track={track} onError={setSaveError} prominent /> : null}
        </View>
      ) : null}
      <ErrorLine message={saveError} />
    </View>
  );
}

const styles = StyleSheet.create({
  compactCard: { backgroundColor: c.panel, borderRadius: radius.large, padding: space[12] },
  compactContent: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  compactIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[10],
    minWidth: 0,
  },
  compactDetails: { flex: 1, minWidth: 0, gap: space[2] },
  compactProducer: { color: c.accent, fontSize: fontSize.smallLabel },
  compactMetadata: { color: c.muted, fontSize: fontSize.caption },
  compactActions: { width: 66, alignItems: 'flex-end', flexShrink: 0, gap: space[2] },
  compactScore: { alignItems: 'flex-end', gap: space[2] },
  score: { color: c.accent, fontSize: fontSize.label, fontWeight: fontWeight.medium },
  unrated: { color: c.muted, fontSize: fontSize.caption, textAlign: 'right' },
  embedded: { backgroundColor: c.bg, borderRadius: radius.large, padding: space[12] },
  card: {
    backgroundColor: c.panel,
    borderRadius: radius.card,
    padding: space[12],
    gap: space[12],
  },
  artLabel: {
    position: 'absolute',
    bottom: space[8],
    left: space[8],
    backgroundColor: c.bg,
    borderRadius: radius.small,
    paddingHorizontal: space[8],
    paddingVertical: space[5],
  },
  artLabelText: { color: c.text, fontSize: fontSize.caption },
  producerTag: {
    alignSelf: 'flex-start',
    backgroundColor: c.selected,
    borderRadius: radius.small,
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    color: c.accent,
    fontSize: fontSize.smallLabel,
  },
  cardIdentity: { flexDirection: 'column', alignItems: 'stretch', gap: space[12] },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[14] },
  cover: { borderRadius: radius.medium, overflow: 'hidden', flexShrink: 0 },
  details: { flex: 1, gap: space[5] },
  title: { fontWeight: fontWeight.medium },
  cardTitle: { fontSize: fontSize.trackTitle },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[10],
    paddingTop: space[0],
    paddingHorizontal: space[4],
    paddingBottom: space[4],
    borderRadius: radius.large,
  },
  ratings: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[10] },
  metadata: { color: c.muted, fontSize: fontSize.smallLabel },
});
