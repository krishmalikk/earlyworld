import { useCommunity } from '../../src/data/community';
import { newPostId } from '../../src/data/post-composer';
import { fontSize, fontWeight, radius, space } from '../../shared/theme';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shareMessage } from '../../shared/links';
import { CommentComposer, CommentRow } from '../../src/components/Comments';
import { router, useLocalSearchParams } from 'expo-router';
import { deleteDoc, doc } from '@react-native-firebase/firestore';
import { db, errorMessage } from '../../src/lib/firebase';
import { useDocument } from '../../src/data/listeners';
import { useLocal } from '../../src/state/local';
import { comment } from '../../src/data/actions';
import type { Stamp, Track } from '../../src/data/types';
import { Artwork, Button, c, Empty, ErrorLine, Page, s, Section } from '../../src/components/ui';
import { CommunityRating } from '../../src/components/RatingDisplay';
import { SaveButton, platformNames } from '../../src/components/TrackRow';
import { RatingEditor, TrackReviews } from '../../src/components/Ratings';
import { StudioCredits } from '../../src/components/StudioCredits';
import { UserLine } from '../../src/components/UserLine';
const SAVER_PREVIEW = 5;
export default function TrackDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    uid = useLocal((s) => s.uid);
  const [body, setBody] = useState(''),
    [requestId, setRequestId] = useState(newPostId),
    [commentCount, setCommentCount] = useState(25),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const refs = useMemo(
    () => ({
      track: doc(db, 'tracks', id),
    }),
    [id],
  );
  const { data: track, loading, error: trackError } = useDocument<Track>(refs.track),
    comments = useCommunity<{ id: string; uid: string; body: string; createdAt: Stamp }>(
      { kind: 'trackComments', itemId: id },
      commentCount,
    ),
    pending = useCommunity<{
      id: string;
      body?: string;
      kind: string;
      targetPath: string;
      status: string;
      reason?: string;
    }>({ kind: 'textSubmissions' }, 25);
  if (!track)
    return (
      <Page>
        <ErrorLine message={trackError} />
        <Empty title={loading ? 'Opening track…' : 'This track is no longer in the catalog.'} />
      </Page>
    );
  async function send() {
    if (!uid || !body.trim()) return;
    setBusy(true);
    try {
      await comment(uid, id, body, requestId);
      setRequestId(newPostId());
      setBody('');
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <View style={styles.hero}>
        <View style={styles.cover}>
          <Artwork uri={track.artworkUrl} name={track.title} size="fill" />
        </View>
        <View style={{ gap: space[8], alignItems: 'center' }}>
          <Text style={[s.title, s.displayTitle, { textAlign: 'center' }]}>{track.title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${track.artistName}`}
            onPress={() =>
              router.push({
                pathname: '/entity/[id]',
                params: { id: track.artistId, type: 'artist' },
              })
            }
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ color: c.accent, fontSize: fontSize.section, textAlign: 'center' }}>
              {track.artistName} ↗
            </Text>
          </Pressable>
          <Text style={[s.muted, { textAlign: 'center' }]}>
            {[
              (track.credits?.releaseDate || track.soundcloud?.publishedAt)?.slice(0, 4),
              track.soundcloud?.genre,
              track.durationSeconds
                ? `${Math.floor(track.durationSeconds / 60)}:${String(Math.floor(track.durationSeconds % 60)).padStart(2, '0')}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {track.credits?.album ? (
            <Text style={[s.muted, { textAlign: 'center' }]}>{track.credits.album}</Text>
          ) : null}
        </View>
        <View style={styles.rating}>
          <CommunityRating track={track} />
        </View>
      </View>
      <View style={[s.between, { flexWrap: 'wrap' }]}>
        {track.sourceStatus === 'unavailable' ? (
          <Text style={[s.muted, { flex: 1 }]}>
            No longer available at its source. Your ratings and saves still count, and the artist
            page has more.
          </Text>
        ) : (
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(track.sourceUrl).catch((e) => setError(errorMessage(e)))}
            style={styles.source}
          >
            <Text style={s.text}>{platformNames[track.sourcePlatform]} ↗</Text>
          </Pressable>
        )}
        <View style={s.row}>
          <Text style={s.muted}>
            {track.saveCount} {track.saveCount === 1 ? 'save' : 'saves'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share track"
            hitSlop={8}
            onPress={() =>
              void Share.share({
                message: shareMessage('track', id, `${track.title} by ${track.artistName}`),
              }).catch(() => setError('Could not open sharing.'))
            }
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="share-outline" size={22} color={c.muted} />
          </Pressable>
          <SaveButton track={track} onError={setError} />
        </View>
      </View>
      <ErrorLine message={error} />
      <RatingEditor key={`rating-${uid}-${id}`} track={track} />
      <View style={[s.panel, { borderLeftWidth: 3, borderLeftColor: c.accent }]}>
        <Text style={s.mono}>PRODUCED BY</Text>
        {track.producerId ? (
          <Text
            onPress={() =>
              router.push({
                pathname: '/entity/[id]',
                params: { id: track.producerId!, type: 'producer' },
              })
            }
            style={[s.text, { fontWeight: fontWeight.bold, color: c.accent }]}
          >
            {track.producerName} ↗
          </Text>
        ) : (
          <Text style={s.muted}>Not credited yet.</Text>
        )}
      </View>
      <StudioCredits key={`studio-${id}`} track={track} />
      <TrackReviews key={`reviews-${id}`} trackId={id} />
      <Section
        title="Saved by"
        right={
          track.savers.length > SAVER_PREVIEW ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/track/savers/[id]', params: { id } })}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[12] }}
            >
              <Text style={s.link}>View all {track.savers.length}</Text>
            </Pressable>
          ) : undefined
        }
      >
        {track.savers.slice(0, SAVER_PREVIEW).map((saver) => (
          <UserLine key={saver} uid={saver} />
        ))}
        {!track.savers.length ? <Text style={s.muted}>No saves yet.</Text> : null}
        {track.saversCapped ? (
          <Text style={s.muted}>
            Showing early listeners. This track has grown beyond rare matching.
          </Text>
        ) : null}
      </Section>
      <Section title={`Discussion · ${comments.data.length}`}>
        <CommentComposer
          value={body}
          onChange={(t) => {
            setBody(t);
            setRequestId(newPostId());
          }}
          onSubmit={send}
          busy={busy}
        />
        <ErrorLine message={error || comments.error} />
        {uid
          ? pending.data
              .filter(
                (p) =>
                  p.kind === 'trackComment' &&
                  p.targetPath.startsWith(`tracks/${id}/`) &&
                  p.status !== 'approved',
              )
              .map((p) => (
                <CommentRow
                  key={p.id}
                  uid={uid}
                  body={p.body || ''}
                  status={p.status}
                  reason={p.reason}
                  own
                />
              ))
          : null}
        {comments.data.map((item) => (
          <CommentRow
            key={item.id}
            uid={item.uid}
            body={item.body}
            createdAt={item.createdAt?.toDate()}
            own={item.uid === uid}
            onDelete={() =>
              void deleteDoc(doc(db, 'tracks', id, 'comments', item.id)).catch((e) =>
                setError(errorMessage(e)),
              )
            }
            onReport={() =>
              router.push({
                pathname: '/community',
                params: { reportKind: 'trackComment', reportId: item.id, trackId: id },
              })
            }
          />
        ))}
        {comments.more ? (
          <Button quiet onPress={() => setCommentCount((n) => n + 25)}>
            More comments
          </Button>
        ) : null}
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space[16], paddingVertical: space[12] },
  cover: {
    width: '80%',
    maxWidth: 320,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.line,
  },
  rating: {
    borderRadius: radius.pill,
    backgroundColor: c.selected,
    paddingHorizontal: space[16],
    paddingVertical: space[8],
  },
  source: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space[18],
    borderRadius: radius.pill,
    backgroundColor: c.panel,
  },
});
