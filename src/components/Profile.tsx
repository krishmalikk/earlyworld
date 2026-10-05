import { useCommunity } from '../data/community';
import { fontSize, fontWeight, radius, space } from '../../shared/theme';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { collection, doc, limit, orderBy, query } from '@react-native-firebase/firestore';
import { router } from 'expo-router';
import { useRatingList } from '../data/ratings';
import { HighestRated } from './HighestRated';
import { FavoriteTracks } from './FavoriteTracks';
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
    <Page>
      {own ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
            style={{ padding: space[12] }}
          >
            <Ionicons name="settings-outline" size={24} color={c.text} />
          </Pressable>
        </View>
      ) : null}
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
        <View style={styles.avatar}>
          <Artwork uri={user.data?.avatarUrl} name={user.data?.username || 'ew'} size={88} />
        </View>
        <View style={{ gap: space[8], alignSelf: 'stretch' }}>
          <Text style={s.title}>
            {user.data ? `@${user.data.username || 'listener'}` : 'Profile'}
          </Text>
          {user.data?.bio ? <Text style={s.text}>{user.data.bio}</Text> : null}
        </View>
        {user.data?.scenes?.length ? (
          <View style={[s.grid, { alignSelf: 'stretch' }]}>
            {user.data.scenes.map((scene) => (
              <View key={scene} style={styles.scene}>
                <Text style={s.link}>{scene}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.stats}>
          <Text style={styles.statsTitle}>Profile stats</Text>
          {(
            [
              ['Followers', user.data?.followerCount || 0],
              ['Saved', user.data?.saveCount || 0],
              ['Ratings', (user.data?.ratingCount || 0) + (user.data?.releaseRatingCount || 0)],
              ['Reviews', (user.data?.reviewCount || 0) + (user.data?.releaseReviewCount || 0)],
            ] as [string, number][]
          ).map(([label, count], index) => (
            <View key={label}>
              {index > 0 ? <View style={styles.statDivider} /> : null}
              <View
                accessible
                accessibilityLabel={`${count} ${label}`}
                style={styles.statRow}
              >
                <Text style={s.muted}>{label}</Text>
                <Text style={styles.number}>{count.toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </View>
        {own ? (
          <View style={{ alignSelf: 'stretch', gap: space[12] }}>
            <Button
              quiet
              onPress={() => {
                setEditing(!editing);
                setBio(user.data?.bio || '');
              }}
            >
              {editing ? 'Cancel edit' : 'Edit bio'}
            </Button>
            {editing ? (
              <>
                <Field
                  accessibilityLabel="Profile bio"
                  multiline
                  maxLength={160}
                  value={bio}
                  onChangeText={setBio}
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
              </>
            ) : null}
          </View>
        ) : currentUid ? (
          <View style={{ alignSelf: 'stretch' }}>
            <Button
              onPress={async () => {
                try {
                  await follow(currentUid, uid, 'user', !!following.data);
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            >
              {following.data ? 'Following · unfollow' : 'Follow listener'}
            </Button>
          </View>
        ) : null}
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
      <Section title="Posts & videos">
        <View style={s.row}>
          <Button
            quiet
            onPress={() =>
              router.push({ pathname: '/posts', params: { mode: 'profile', uid, kind: 'post' } })
            }
          >
            Posts
          </Button>
          <Button
            quiet
            onPress={() =>
              router.push({ pathname: '/posts', params: { mode: 'profile', uid, kind: 'video' } })
            }
          >
            Videos
          </Button>
        </View>
        {own ? (
          <>
            <Button
              quiet
              onPress={() => router.push({ pathname: '/posts', params: { mode: 'own' } })}
            >
              Drafts & submissions
            </Button>
            <Button
              quiet
              onPress={() => router.push({ pathname: '/posts', params: { mode: 'bookmarks' } })}
            >
              Bookmarked posts
            </Button>
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
          </>
        ) : null}
      </Section>
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
const styles = StyleSheet.create({
  hero: {
    backgroundColor: c.panel,
    borderRadius: radius.card,
    padding: space[20],
    gap: space[18],
    alignItems: 'flex-start',
  },
  avatar: {
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: c.accent,
    padding: space[4],
    overflow: 'hidden',
    backgroundColor: c.selected,
  },
  stats: {
    alignSelf: 'stretch',
    backgroundColor: c.bg,
    borderRadius: radius.large,
    paddingHorizontal: space[16],
    paddingVertical: space[14],
  },
  statsTitle: {
    color: c.muted,
    fontSize: fontSize.smallLabel,
    fontWeight: fontWeight.medium,
    marginBottom: space[6],
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[10],
  },
  statDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.line },
  number: { color: c.text, fontSize: fontSize.section, fontWeight: fontWeight.bold },
  scene: {
    backgroundColor: c.selected,
    borderRadius: radius.pill,
    paddingHorizontal: space[12],
    paddingVertical: space[6],
  },
});
