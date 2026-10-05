import { useCommunity } from '../data/community';
import { fontSize, fontWeight, lineHeight, radius, space } from '../../shared/theme';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Rating, Track } from '../data/types';
import { useRatings, ratingMutation, useRatingList } from '../data/ratings';
import { useCatalogIds } from '../data/catalog';
import { errorMessage } from '../lib/firebase';
import { ratingLabel } from '../../shared/ratings';
import { Button, c, ErrorLine, Field, s, Section } from './ui';
import { SaveButton, TrackRow, platformNames } from './TrackRow';
import { UserLine } from './UserLine';
import { useLocal } from '../state/local';
import { Stars, CommunityRating } from './RatingDisplay';

export function RatingEditor({
  track,
  kind = 'track',
}: {
  track: Pick<Track, 'id' | 'title' | 'artistName' | 'ratingCount' | 'ratingHalfStarSum'>;
  kind?: 'track' | 'release';
}) {
  const ratings = useRatings();
  const loading = kind === 'release' ? ratings.releaseLoading : ratings.loading;
  const loadError = kind === 'release' ? ratings.releaseError : ratings.error;
  const existing =
    kind === 'release' ? ratings.byRelease.get(track.id) : ratings.byTrack.get(track.id);
  const pending = useCommunity<{
    id: string;
    kind: string;
    targetPath: string;
    body: string;
    status: string;
    reason?: string;
  }>({ kind: 'reviewSubmission', itemId: track.id, release: kind === 'release' }, 1);
  const revision = pending.data.find(
    (p) =>
      p.kind === 'review' &&
      existing &&
      p.targetPath === `${kind === 'release' ? 'releaseRatings' : 'ratings'}/${existing.id}` &&
      p.status !== 'approved',
  );
  const [open, setOpen] = useState(false),
    [halfStars, setHalfStars] = useState(0),
    [review, setReview] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  function begin() {
    setHalfStars(existing?.halfStars || 0);
    setReview(revision?.body || existing?.review || '');
    setError(null);
    setOpen(true);
  }
  async function submit(remove = false) {
    setBusy(true);
    setError(null);
    try {
      const result = await ratingMutation(
        kind === 'release'
          ? remove
            ? 'deleteReleaseRating'
            : 'setReleaseRating'
          : remove
            ? 'deleteTrackRating'
            : 'setTrackRating',
        {
          ...(kind === 'release' ? { releaseId: track.id } : { trackId: track.id }),
          ...(!remove ? { halfStars, review } : {}),
        },
      );
      setOpen(false);
      if (result.reviewPending)
        Alert.alert('Rating saved', 'Your review is awaiting moderator approval.');
    } catch (e) {
      setError(`Could not save your change. ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={[s.panel, { gap: space[12] }]}>
      <View style={s.between}>
        <Text style={{ color: c.text, fontSize: fontSize.section, fontWeight: fontWeight.bold }}>
          Your impression
        </Text>
        <CommunityRating track={track} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={existing ? 'Edit your rating' : 'Choose a rating'}
        disabled={loading || !!loadError}
        onPress={begin}
        style={{
          alignItems: 'center',
          paddingVertical: space[20],
          backgroundColor: c.bg,
          borderRadius: radius.large,
        }}
      >
        <Stars value={existing?.halfStars || 0} size={30} />
      </Pressable>
      <Button onPress={begin} disabled={loading || !!loadError}>
        {existing ? 'Edit rating & review' : 'Rate & review'}
      </Button>
      {kind === 'track' && existing?.review ? (
        <Button
          quiet
          onPress={() =>
            router.push({ pathname: '/share', params: { card: 'review', trackId: track.id } })
          }
        >
          Share review
        </Button>
      ) : null}
      {revision ? (
        <Text style={s.muted}>
          {revision.status === 'pending'
            ? 'Your review is awaiting approval.'
            : revision.reason || 'Your review was not approved.'}
        </Text>
      ) : null}
      <ErrorLine message={loadError} />
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <SafeAreaView style={s.page}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={[s.body, { gap: space[22] }]}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.title}>{track.title}</Text>
              <Text style={s.muted}>{track.artistName}</Text>
              <View style={{ gap: space[12] }}>
                <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                      key={star}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={`Rate ${star} ${star === 1 ? 'star' : 'stars'}`}
                      onPress={() => setHalfStars(star * 2)}
                      style={{
                        minWidth: 48,
                        minHeight: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons
                        name={
                          halfStars >= star * 2
                            ? 'star'
                            : halfStars === star * 2 - 1
                              ? 'star-half'
                              : 'star-outline'
                        }
                        color={c.accent}
                        size={32}
                      />
                    </Pressable>
                  ))}
                </View>
                <View style={[s.row, { justifyContent: 'center' }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Decrease rating by half a star"
                    disabled={busy || halfStars <= 1}
                    onPress={() => setHalfStars((n) => Math.max(1, n - 1))}
                    style={{ padding: space[14], opacity: halfStars <= 1 ? 0.4 : 1 }}
                  >
                    <Ionicons name="remove" size={20} color={c.accent} />
                  </Pressable>
                  <Text accessibilityLiveRegion="polite" style={s.text}>
                    {halfStars ? ratingLabel(halfStars) : 'Choose your rating'}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Increase rating by half a star"
                    disabled={busy || halfStars >= 10}
                    onPress={() => setHalfStars((n) => Math.min(10, n + 1))}
                    style={{ padding: space[14], opacity: halfStars >= 10 ? 0.4 : 1 }}
                  >
                    <Ionicons name="add" size={20} color={c.accent} />
                  </Pressable>
                </View>
                <Text style={[s.muted, { textAlign: 'center' }]}>
                  Tap a star. Use − / + for half stars.
                </Text>
              </View>
              <View style={{ gap: space[8] }}>
                <Field
                  accessibilityLabel="Your review, optional"
                  placeholder="Write a review (optional)"
                  multiline
                  maxLength={500}
                  editable={!busy}
                  value={review}
                  onChangeText={setReview}
                  style={{ minHeight: 130, textAlignVertical: 'top' }}
                />
                <Text style={s.muted}>
                  {review.length}/500 · Reviews are approved before publication
                </Text>
                {review ? (
                  <Button quiet disabled={busy} onPress={() => setReview('')}>
                    Clear review text
                  </Button>
                ) : null}
              </View>
              <ErrorLine message={error} />
              <Button disabled={!halfStars} busy={busy} onPress={() => submit()}>
                {existing ? 'Save changes' : 'Publish rating'}
              </Button>
              {existing ? (
                <Button
                  quiet
                  disabled={busy}
                  onPress={() =>
                    Alert.alert(
                      'Remove your rating?',
                      'Your rating and review will be removed. Saves and favorites stay as they are.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => void submit(true) },
                      ],
                    )
                  }
                >
                  Remove rating & review
                </Button>
              ) : null}
              <Button quiet disabled={busy} onPress={() => setOpen(false)}>
                Cancel
              </Button>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

export function RatingCard({
  rating,
  showTrack = true,
  showAuthor = true,
  excerpt = false,
}: {
  rating: Rating;
  showTrack?: boolean;
  showAuthor?: boolean;
  excerpt?: boolean;
}) {
  const catalog = useCatalogIds('tracks', showTrack ? [rating.trackId] : []);
  const currentUid = useLocal((s) => s.uid);
  const [saveError, setSaveError] = useState<string | null>(null);
  const track = catalog.byId.get(rating.trackId);
  const edited = rating.updatedAt?.toMillis() > rating.createdAt?.toMillis();
  return (
    <View style={[s.panel, { gap: space[16], padding: space[18], borderWidth: 0 }]}>
      {showAuthor ? (
        <UserLine uid={rating.uid} detail={rating.review ? 'reviewed a track' : 'rated a track'} />
      ) : null}
      {showTrack ? (
        track ? (
          <TrackRow track={track} showOwnRating={false} variant="embedded" />
        ) : (
          <Text style={s.muted}>Track unavailable</Text>
        )
      ) : null}
      <View style={[s.between, { flexWrap: 'wrap' }]}>
        <View style={s.row}>
          <Stars value={rating.halfStars} size={17} />
          <Text style={[s.text, { color: c.accent }]}>{(rating.halfStars / 2).toFixed(1)}</Text>
        </View>
        <Text style={[s.muted, { fontSize: fontSize.caption }]}>
          {rating.createdAt?.toDate().toLocaleDateString()}
          {edited ? ' · edited' : ''}
        </Text>
      </View>
      {rating.review ? (
        <Text
          numberOfLines={excerpt ? 4 : undefined}
          style={[s.text, { fontSize: fontSize.trackTitle, lineHeight: lineHeight.reading }]}
        >
          {rating.review}
        </Text>
      ) : null}
      {showTrack && track ? (
        <View style={s.between}>
          <Text style={s.muted}>
            {platformNames[track.sourcePlatform]} · {track.saveCount}{' '}
            {track.saveCount === 1 ? 'save' : 'saves'}
          </Text>
          <SaveButton track={track} onError={setSaveError} />
        </View>
      ) : null}
      {rating.uid === currentUid ? (
        rating.review ? (
          <Button
            quiet
            onPress={() =>
              router.push({
                pathname: '/share',
                params: { card: 'review', trackId: rating.trackId },
              })
            }
          >
            Share review
          </Button>
        ) : null
      ) : (
        <Button
          quiet
          onPress={() =>
            router.push({
              pathname: '/community',
              params: { reportKind: 'rating', reportId: rating.id },
            })
          }
        >
          Report review
        </Button>
      )}
      <ErrorLine message={saveError} />
      {excerpt && rating.review ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/track/${rating.trackId}`)}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={s.link}>View track & reviews ↗</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
export function TrackReviews({ trackId }: { trackId: string }) {
  const [count, setCount] = useState(25);
  const list = useRatingList({ trackId, count });
  return (
    <Section title="Ratings & reviews">
      <ErrorLine message={list.error} />
      {list.loading ? <ActivityIndicator color={c.accent} /> : null}
      {list.data.map((rating) => (
        <RatingCard key={rating.id} rating={rating} showTrack={false} />
      ))}
      {!list.loading && !list.data.length && !list.error ? (
        <Text style={s.muted}>No ratings yet.</Text>
      ) : null}
      {list.data.length >= count ? (
        <Button quiet onPress={() => setCount((n) => n + 25)}>
          Load more ratings
        </Button>
      ) : null}
    </Section>
  );
}
