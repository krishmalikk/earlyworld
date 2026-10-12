import { useCommunity } from '../data/community';
import { fontSize, fontWeight, lineHeight, radius, space, tracking } from '../../shared/theme';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { collection, doc, limit, orderBy, query } from '@react-native-firebase/firestore';
import { router } from 'expo-router';
import { useRatingList } from '../data/ratings';
import { HighestRated } from './HighestRated';
import { FavoriteTracks } from './FavoriteTracks';
import { ProfilePosts } from './ProfilePosts';
import { ReleaseReviews } from './Releases';
import { RatingCard } from './Ratings';
import { Ionicons } from '@expo/vector-icons';
import { useDocument } from '../data/listeners';
import { useCatalogIds } from '../data/catalog';
import { call, db, errorMessage } from '../lib/firebase';
import { useLocal } from '../state/local';
import { follow } from '../data/actions';
import type { Follow, Rotation, Save, User } from '../data/types';
import { Artwork, Button, Empty, ErrorLine, Field, c, Page, s, Section } from './ui';
import { EntityCard } from './EntityCard';
import { TrackRow } from './TrackRow';
export function Profile({ uid }: { uid: string }) {
  const currentUid = useLocal((s) => s.uid),
    own = uid === currentUid;
  const [error, setError] = useState<string | null>(null),
    [editing, setEditing] = useState(false),
    [bio, setBio] = useState('');
  const refs = useMemo(
    () => ({
      user: doc(db, 'users', uid),
      rotation: query(collection(db, 'users', uid, 'rotation'), orderBy('score', 'desc')),
      saves: query(collection(db, 'users', uid, 'saves'), orderBy('savedAt', 'desc'), limit(30)),
      follow: currentUid ? doc(db, 'users', currentUid, 'following', uid) : null,
    }),
    [uid, currentUid],
  );
  const profiles = useCommunity<User>({ kind: 'profile', uid }),
    user = { data: profiles.data[0], error: profiles.error },
    rotation = useCommunity<Rotation>({ kind: 'rotation', uid }),
    saves = useCommunity<Save>({ kind: 'saves', uid }, 30),
    following = useDocument<Follow>(refs.follow);
  const catalog = useCatalogIds(
    'tracks',
    saves.data.map((s) => s.trackId),
  );
  const highest = useRatingList({ uid, highest: true, count: 12 });
  const recent = useRatingList({ uid, count: 5 });
  const submissions = useCommunity<{
    id: string;
    kind: string;
    status: string;
    reason?: string;
    body?: string;
    fields?: { bio?: string };
  }>({ kind: 'textSubmissions' }, 25, own);
  const certified = rotation.data.filter((r) => r.tier);
  return (
    <Page gap={space[30]}>
      <ErrorLine message={user.error} />
      {!own && user.data ? (
        <View style={s.row}>
          <Button
            quiet
            onPress={() =>
              router.push({
                pathname: '/community',
                params: { reportKind: 'profile', reportId: uid },
              })
            }
          >
            Report profile
          </Button>
          <Button
            quiet
            onPress={() =>
              Alert.alert(
                'Block this listener?',
                'You will no longer see each other’s community content.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Block',
                    style: 'destructive',
                    onPress: () => {
                      void call('setUserBlock', { uid, blocked: true })
                        .then(() => router.back())
                        .catch((e) => setError(errorMessage(e)));
                    },
                  },
                ],
              )
            }
          >
            Block
          </Button>
        </View>
      ) : null}
      <View style={styles.hero}>
        <View style={styles.banner} />
        <View style={styles.heroBody}>
          <View style={styles.heroTop}>
            <View style={styles.avatar}>
              <View style={styles.avatarInner}>
                <Artwork
                  uri={user.data?.avatarUrl}
                  name={user.data?.username || 'ew'}
                  size={AVATAR}
                />
              </View>
            </View>
            {own ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={editing ? 'Cancel bio edit' : 'Edit bio'}
                onPress={() => {
                  setEditing(!editing);
                  setBio(user.data?.bio || '');
                }}
                style={({ pressed }) => [styles.editButton, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name={editing ? 'close' : 'pencil-outline'} size={18} color={c.text} />
              </Pressable>
            ) : currentUid ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: !!following.data }}
                onPress={async () => {
                  try {
                    await follow(currentUid, uid, 'user', !!following.data);
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
                style={({ pressed }) => [
                  styles.followButton,
                  following.data ? styles.following : null,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.followText, following.data && { color: c.text }]}>
                  {following.data ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ gap: space[4] }}>
            <Text style={[s.title, s.displayHeading]}>
              {user.data ? `@${user.data.username || 'listener'}` : 'Profile'}
            </Text>
            {user.data?.bio ? <Text style={styles.bio}>{user.data.bio}</Text> : null}
          </View>
          <View style={styles.statLine}>
            {(
              [
                ['follower', 'followers', user.data?.followerCount || 0],
                ['save', 'saved', user.data?.saveCount || 0],
                [
                  'rating',
                  'ratings',
                  (user.data?.ratingCount || 0) + (user.data?.releaseRatingCount || 0),
                ],
                [
                  'review',
                  'reviews',
                  (user.data?.reviewCount || 0) + (user.data?.releaseReviewCount || 0),
                ],
              ] as [string, string, number][]
            ).map(([one, many, count], index) => (
              <View key={many} style={styles.statItem}>
                {index > 0 ? <Text style={styles.statDot}>·</Text> : null}
                <Text
                  accessibilityLabel={`${count} ${count === 1 ? one : many}`}
                  style={styles.statLabel}
                >
                  <Text style={styles.statNumber}>{count.toLocaleString()}</Text>{' '}
                  {count === 1 ? one : many}
                </Text>
              </View>
            ))}
          </View>
          {user.data?.scenes?.length ? (
            <View style={{ gap: space[10] }}>
              <Text style={styles.eyebrow}>Sounds like</Text>
              <View style={s.grid}>
                {user.data.scenes.map((scene) => (
                  <View key={scene} style={styles.scene}>
                    <Text style={styles.sceneText}>{scene}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {own && editing ? (
            <View style={{ gap: space[12] }}>
              <Field
                accessibilityLabel="Profile bio"
                multiline
                maxLength={160}
                value={bio}
                onChangeText={setBio}
                autoFocus
              />
              <Button
                onPress={async () => {
                  try {
                    await call('submitProfileText', { bio });
                    setEditing(false);
                    Alert.alert(
                      'Awaiting review',
                      'Your current bio stays visible until the change is approved.',
                    );
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              >
                Submit bio for review
              </Button>
            </View>
          ) : null}
        </View>
      </View>
      <ErrorLine
        message={
          error || user.error || rotation.error || saves.error || highest.error || recent.error
        }
      />
      <FavoriteTracks
        key={`${currentUid}:${uid}`}
        ids={user.data?.favoriteTrackIds || []}
        own={own}
      />
      <FavoriteTracks
        key={`releases:${currentUid}:${uid}`}
        ids={user.data?.favoriteReleaseIds || []}
        own={own}
        kind="release"
      />
      <ProfilePosts key={`posts:${currentUid}:${uid}`} uid={uid} own={own} />
      {own ? (
        <Section title="Submissions & bookmarks">
          <View style={[s.panel, { padding: space[0], gap: space[0] }]}>
            {(
              [
                ['create-outline', 'Drafts & submissions', 'own'],
                ['bookmark-outline', 'Bookmarked posts', 'bookmarks'],
              ] as const
            ).map(([icon, label, mode], index) => (
              <View key={mode}>
                {index > 0 ? <View style={styles.statDivider} /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/posts', params: { mode } })}
                  style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Ionicons name={icon} size={20} color={c.accent} />
                  <Text style={[s.text, { flex: 1 }]}>{label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={c.muted} />
                </Pressable>
              </View>
            ))}
          </View>
          {submissions.data
            .filter((p) => p.status !== 'approved')
            .map((p) => (
              <View key={p.id} style={s.panel}>
                <Text style={s.text}>
                  {p.kind === 'review'
                    ? 'Review'
                    : p.kind === 'profile'
                      ? 'Profile update'
                      : 'Comment'}{' '}
                  · {p.status === 'pending' ? 'Awaiting review' : 'Not approved'}
                </Text>
                <Text style={s.muted}>{p.reason || p.body || p.fields?.bio}</Text>
              </View>
            ))}
        </Section>
      ) : null}
      <ReleaseReviews key={`release-reviews:${uid}`} uid={uid} preview />
      <Section title="Highest rated">
        <HighestRated ratings={highest.data} />
        {!highest.loading && !highest.data.length ? (
          <Text style={s.muted}>
            {own
              ? 'Tracks you rate 4 stars or higher appear here.'
              : 'No tracks rated four stars or higher yet.'}
          </Text>
        ) : null}
        {highest.data.length ? (
          <Button
            quiet
            onPress={() =>
              router.push({ pathname: '/user/ratings/[id]', params: { id: uid, sort: 'highest' } })
            }
          >
            View all highest rated
          </Button>
        ) : null}
      </Section>
      <Section title="Ratings & reviews">
        {recent.data.map((rating) => (
          <RatingCard key={rating.id} rating={rating} showAuthor={false} excerpt />
        ))}
        {!recent.loading && !recent.data.length ? (
          <Text style={s.muted}>{own ? 'Rate a track to add it here.' : 'No ratings yet.'}</Text>
        ) : null}
        {recent.data.length ? (
          <Button
            quiet
            onPress={() => router.push({ pathname: '/user/ratings/[id]', params: { id: uid } })}
          >
            View all ratings & reviews
          </Button>
        ) : null}
      </Section>
      <Section title="Saved tracks">
        {saves.data.map((save) => {
          const track = catalog.byId.get(save.trackId);
          return track ? (
            <TrackRow key={save.id} track={track} variant="card" />
          ) : (
            <Text key={save.id} style={s.muted}>
              {save.title} / {save.artistName}
            </Text>
          );
        })}
        {!saves.data.length ? <Text style={s.muted}>Nothing saved yet.</Text> : null}
      </Section>
      <Section title="Rotation">
        {certified.length ? (
          <View style={s.grid}>
            {certified.map((r) => (
              <EntityCard
                key={r.id}
                entity={{
                  id: r.entityId,
                  name: r.name,
                  imageUrl: r.imageUrl,
                  aliases: [],
                  trackCount: 0,
                }}
                type={r.entityType}
                rotation={r}
              />
            ))}
          </View>
        ) : (
          <Empty
            title="No Rotation yet."
            detail={own ? 'Build Rotation through saves and comments.' : undefined}
          />
        )}
      </Section>
    </Page>
  );
}
const AVATAR = 80;
const BANNER = 96;
// Ring (3) + gap (4) on each side of the artwork.
const AVATAR_OUTER = AVATAR + 14;
const styles = StyleSheet.create({
  hero: { backgroundColor: c.panel, borderRadius: radius.card, overflow: 'hidden' },
  banner: {
    height: BANNER,
    backgroundColor: c.banner,
    borderBottomWidth: 2,
    borderBottomColor: c.accent,
  },
  heroBody: { paddingHorizontal: space[20], paddingBottom: space[22], gap: space[14] },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -AVATAR_OUTER / 2,
  },
  avatar: {
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: c.accent,
    padding: space[4],
    backgroundColor: c.panel,
  },
  avatarInner: { borderRadius: radius.pill, overflow: 'hidden' },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButton: {
    minHeight: 40,
    paddingHorizontal: space[18],
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    borderWidth: 1,
    borderColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  following: { backgroundColor: 'transparent', borderColor: c.line },
  followText: { color: c.bg, fontSize: fontSize.label, fontWeight: fontWeight.bold },
  bio: { color: c.muted, fontSize: fontSize.body, lineHeight: lineHeight.content },
  statLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: space[4] },
  statItem: { flexDirection: 'row', alignItems: 'center' },
  statDot: { color: c.muted, fontSize: fontSize.body, marginHorizontal: space[8] },
  statLabel: { color: c.muted, fontSize: fontSize.body, lineHeight: lineHeight.content },
  statNumber: { color: c.text, fontWeight: fontWeight.bold },
  eyebrow: {
    color: c.muted,
    fontSize: fontSize.smallLabel,
    fontWeight: fontWeight.bold,
    letterSpacing: tracking.badge,
    textTransform: 'uppercase',
  },
  sceneText: { color: c.accent, fontSize: fontSize.navigation },
  statDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.line },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    minHeight: 52,
    paddingHorizontal: space[16],
  },
  scene: {
    backgroundColor: c.selected,
    borderRadius: radius.pill,
    paddingHorizontal: space[14],
    paddingVertical: space[7],
  },
});
