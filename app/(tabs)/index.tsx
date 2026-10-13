import { useCommunity } from '../../src/data/community';
import type { Stamp } from '../../src/data/types';
import { fontFamily, fontSize, fontWeight, radius, space, tracking } from '../../shared/theme';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from '@react-native-firebase/firestore';
import { db, errorMessage } from '../../src/lib/firebase';
import { useLocal } from '../../src/state/local';
import { useSession } from '../../src/data/session';
import { useCatalogIds, useCatalogPage } from '../../src/data/catalog';
import { useCollection, useForeground } from '../../src/data/listeners';
import type { Follow, Rating, ReleaseRating, Track } from '../../src/data/types';
import { Tabs, router } from 'expo-router';
import { Artwork, c, Empty, ErrorLine, Page, s, Segmented } from '../../src/components/ui';
import { FeedCarousel } from '../../src/components/FeedCarousel';
import { usePostPage } from '../../src/data/social';
import { PostCard } from '../../src/components/PostCard';
import { VideoFeed } from '../../src/components/VideoFeed';
import type { SocialPost } from '../../shared/social';
import { mergeFeedEntries } from '../../shared/feed';
import { averageRating } from '../../shared/ratings';
import { SaveButton } from '../../src/components/TrackRow';
import { useForYou } from '../../src/data/for-you';
import { FeedReview } from '../../src/components/FeedReview';
import { Ionicons } from '@expo/vector-icons';

type Entry = {
  key: string;
  trackId: string;
  at: number;
  rating?: Rating;
  releaseRating?: ReleaseRating;
  post?: SocialPost;
  /** Why For You chose this item. */
  reason?: string;
};
const VIEWS = [
  { value: 'feed', label: 'Feed' },
  { value: 'videos', label: 'Videos' },
] as const;
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'posts', label: 'Posts' },
  { value: 'reviews', label: 'Reviews' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];
export default function Feed() {
  const [view, setView] = useState<(typeof VIEWS)[number]['value']>('feed');
  return (
    <View style={s.page}>
      <Tabs.Screen
        options={{
          headerRight: () => (
            <Segmented
              compact
              options={VIEWS}
              value={view}
              onChange={setView}
              style={{ marginRight: space[16], width: 148 }}
            />
          ),
        }}
      />
      {view === 'videos' ? <VideoFeed /> : <Timeline />}
    </View>
  );
}
function Timeline() {
  const uid = useLocal((s) => s.uid),
    { user } = useSession(),
    active = useForeground();
  const [filter, setFilter] = useState<Filter>('all');
  const posts = usePostPage({ mode: 'following' });
  const forYou = useForYou();
  const tailored: Entry[] = forYou.data.flatMap((item): Entry[] => {
    if (item.type === 'post')
      return [
        {
          key: `post:${item.data.id}`,
          trackId: '',
          at: item.at,
          post: item.data,
          reason: item.reason,
        },
      ];
    return item.type === 'rating'
      ? [
          {
            key: `rating:${item.data.id}`,
            trackId: item.data.trackId,
            at: item.at,
            rating: item.data,
            reason: item.reason,
          },
        ]
      : [
          {
            key: `releaseRating:${item.data.id}`,
            trackId: '',
            at: item.at,
            releaseRating: item.data,
            reason: item.reason,
          },
        ];
  });
  const [page, setPage] = useState(25),
    [state, setState] = useState<{ key: string; rows: Entry[]; error: string | null }>({
      key: '',
      rows: [],
      error: null,
    });
  const followingRef = useMemo(
    () => (uid ? collection(db, 'users', uid, 'following') : null),
    [uid],
  );
  const follows = useCollection<Follow>(followingRef, true);
  const key = `${uid}:${filter}:${follows.data
    .map((f) => `${f.targetType}:${f.id}`)
    .sort()
    .join('|')}`;
  useEffect(() => {
    setPage(25);
  }, [key, filter]);
  useEffect(() => {
    if (!active || !uid) return;
    const streams = new Map<number, Entry[]>();
    const unsubscribes: (() => void)[] = [];
    let index = 0,
      live = true;
    const publish = () => {
      if (live)
        setState((previous) => ({
          key,
          rows: mergeFeedEntries(
            [...streams.values()],
            page,
            filter === 'reviews' ? (entry) => !!entry.rating : undefined,
          ),
          error: previous.key === key ? previous.error : null,
        }));
    };
    const fail = (e: unknown) => {
      if (live)
        setState((previous) => ({
          key,
          rows: previous.key === key ? previous.rows : [],
          error: errorMessage(e),
        }));
    };
    for (const type of ['artist', 'producer'] as const) {
      const ids = follows.data.filter((f) => f.targetType === type).map((f) => f.id);
      for (let offset = 0; offset < ids.length; offset += 30) {
        const group = ids.slice(offset, offset + 30),
          stream = index++,
          isUser = false;
        const ref = query(
          collection(db, isUser ? 'activity' : 'tracks'),
          where(isUser ? 'actorUid' : type === 'artist' ? 'artistId' : 'producerId', 'in', group),
          orderBy(isUser ? 'savedAt' : 'createdAt', 'desc'),
          limit(page),
        );
        unsubscribes.push(
          onSnapshot(
            ref,
            (snap) => {
              streams.set(
                stream,
                snap.docs.map((d) => ({
                  key: `track:${isUser ? d.data().trackId : d.id}`,
                  trackId: isUser ? d.data().trackId : d.id,
                  at: d.data()[isUser ? 'savedAt' : 'createdAt']?.toMillis() || 0,
                })),
              );
              publish();
            },
            fail,
          ),
        );
      }
    }
    if (!index) setState({ key, rows: [], error: null });
    return () => {
      live = false;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [uid, key, page, active, filter]);
  const opinions = useCommunity<Rating>({ kind: 'ratings', following: true }, page);
  const saves = useCommunity<{ id: string; trackId: string; savedAt: Stamp }>(
    { kind: 'activity', following: true },
    page,
  );
  const rows = mergeFeedEntries<Entry>(
    [
      state.key === key ? state.rows : [],
      opinions.data.map((rating) => ({
        key: `rating:${rating.id}`,
        trackId: rating.trackId,
        at: rating.createdAt?.toMillis() || 0,
        rating,
      })),
      saves.data.map((save) => ({
        key: `save:${save.id}`,
        trackId: save.trackId,
        at: save.savedAt?.toMillis() || 0,
      })),
    ],
    page,
  );
  const fallback = useCatalogPage('tracks', {
    scenes: user?.scenes || [],
    enabled: !rows.some((entry) => !entry.rating),
  });
  // New tracks and saves from follows; scene picks stand in until there are any.
  const activity: Entry[] = rows.some((entry) => !entry.rating)
    ? rows.filter((entry) => !entry.rating)
    : fallback.data.map((track) => ({ key: `fallback:${track.id}`, trackId: track.id, at: 0 }));
  // Tailored copies go first so their reasons win over the same item from follows.
  const reviews = mergeFeedEntries(
    [
      tailored.filter((entry) => entry.rating || entry.releaseRating),
      rows.filter((entry) => entry.rating),
    ],
    page,
  );
  const postEntries = mergeFeedEntries(
    [
      tailored.filter((entry) => entry.post),
      posts.data.map((post) => ({
        key: `post:${post.id}`,
        trackId: '',
        at: post.publishedAt,
        post,
      })),
    ],
    page,
  );
  const data = filter === 'posts' ? postEntries : filter === 'reviews' ? reviews : activity;
  const written = reviews.filter((entry) => (entry.rating || entry.releaseRating)?.review);
  // Newer posts can fill the first For You pages; keep reading (up to ~100 items) until the
  // reviews row has something to show.
  useEffect(() => {
    if (written.length < 6 && forYou.more && !forYou.loading && forYou.data.length < 100)
      forYou.loadMore();
  }, [written.length, forYou.more, forYou.loading, forYou.data.length]);
  // The carousel draws on track activity, not the merged feed, which posts can fill.
  const shelfSource = useMemo(
    () => mergeFeedEntries([activity, reviews.filter((entry) => entry.rating)], 40),
    [activity, reviews],
  );
  const catalog = useCatalogIds(
    'tracks',
    [...activity, ...shelfSource].map((entry) => entry.trackId).filter(Boolean),
  );
  const shelf = useMemo(() => {
    const seen = new Set<string>();
    return shelfSource
      .flatMap((entry) => {
        const track = catalog.byId.get(entry.trackId);
        if (!track || seen.has(track.id)) return [];
        seen.add(track.id);
        return [track];
      })
      .slice(0, 8);
  }, [shelfSource, catalog.byId]);
  return (
    <Page scroll={false}>
      <FlatList
        contentContainerStyle={[s.body, { gap: space[0] }]}
        data={data}
        keyExtractor={(item) => item.key}
        onEndReached={() => {
          if (filter !== 'all' && forYou.more && !forYou.loading) forYou.loadMore();
          if (filter === 'posts' && posts.more && !posts.loading) posts.loadMore();
          if (data.length >= page) setPage((p) => p + 25);
          if (filter === 'all' && fallback.hasMore && !fallback.loading && !fallback.error)
            fallback.loadMore();
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ gap: space[20], paddingBottom: space[10] }}>
            <View style={styles.filters}>
              {FILTERS.map((f) => {
                const selected = filter === f.value;
                return (
                  <Pressable
                    key={f.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setFilter(f.value)}
                    style={[styles.filter, selected && styles.filterOn]}
                  >
                    <Text style={[styles.filterText, selected && { color: c.bg }]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {filter === 'all' && shelf.length ? <FeedCarousel tracks={shelf} /> : null}
            {filter === 'all' && written.length ? (
              <View style={{ gap: space[12] }}>
                <SectionHeader title="Reviews for you" onMore={() => setFilter('reviews')} />
                <FlatList
                  horizontal
                  data={written.slice(0, 10)}
                  keyExtractor={(entry) => entry.key}
                  showsHorizontalScrollIndicator={false}
                  style={{ marginHorizontal: -space[18] }}
                  contentContainerStyle={{ paddingHorizontal: space[18], gap: space[12] }}
                  renderItem={({ item }) => (
                    <FeedReview
                      tile
                      rating={(item.rating || item.releaseRating)!}
                      reason={item.reason}
                    />
                  )}
                />
              </View>
            ) : null}
            {filter === 'all' && postEntries.length ? (
              <View style={{ gap: space[12] }}>
                <SectionHeader title="Posts" onMore={() => setFilter('posts')} />
                {postEntries.slice(0, 3).map((entry) => (
                  <ReasonedPost key={entry.key} post={entry.post!} reason={entry.reason} />
                ))}
              </View>
            ) : null}
            <ErrorLine
              message={
                (state.key === key ? state.error : null) ||
                posts.error ||
                forYou.error ||
                opinions.error ||
                saves.error ||
                follows.error ||
                catalog.error ||
                fallback.error
              }
            />
            {filter === 'all' && activity.length ? (
              <SectionHeader
                title={rows.some((e) => !e.rating) ? 'New from your artists' : 'From your scenes'}
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          if (item.post)
            return (
              <View style={styles.cardItem}>
                <ReasonedPost post={item.post} reason={item.reason} />
              </View>
            );
          if (item.rating || item.releaseRating)
            return (
              <View style={styles.cardItem}>
                <FeedReview rating={(item.rating || item.releaseRating)!} reason={item.reason} />
              </View>
            );
          const track = catalog.byId.get(item.trackId);
          return track ? <ActivityRow entry={item} track={track} /> : null;
        }}
        ListEmptyComponent={
          <Empty
            title={
              filter === 'reviews'
                ? 'No reviews for you yet.'
                : filter === 'posts'
                  ? 'No posts for you yet.'
                  : 'No activity yet.'
            }
            detail="Follow artists or listeners to see their activity here."
          />
        }
      />
    </Page>
  );
}

function SectionHeader({ title, onMore }: { title: string; onMore?: () => void }) {
  return (
    <View style={s.between}>
      <Text numberOfLines={1} style={styles.sectionTitle}>
        {title}
      </Text>
      {onMore ? (
        <Pressable accessibilityRole="button" onPress={onMore} hitSlop={8}>
          <Text style={s.link}>See all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
function ReasonedPost({ post, reason }: { post: SocialPost; reason?: string }) {
  return (
    <View style={{ gap: space[8] }}>
      {reason ? (
        <View style={styles.reason}>
          <Ionicons name="sparkles" size={12} color={c.accent} />
          <Text numberOfLines={1} style={styles.reasonText}>
            {reason}
          </Text>
        </View>
      ) : null}
      <PostCard post={post} />
    </View>
  );
}
/** Why this track is in the activity list, from the stream that produced it. */
function context(entry: Entry, track: Track) {
  if (entry.key.startsWith('track:')) return `New from ${track.artistName}`;
  if (entry.key.startsWith('fallback:'))
    return track.soundcloud?.genre
      ? `From your scenes · ${track.soundcloud.genre}`
      : 'From your scenes';
  return null;
}
function ActivityRow({ entry, track }: { entry: Entry; track: Track }) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const average = averageRating(track.ratingCount, track.ratingHalfStarSum);
  const why = context(entry, track);
  const saves = `${(track.saveCount ?? 0).toLocaleString()} ${track.saveCount === 1 ? 'save' : 'saves'}`;
  return (
    <View style={styles.rowWrap}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${track.title} by ${track.artistName}${track.producerName ? `, produced by ${track.producerName}` : ''}. ${why ? `${why}. ` : ''}${average ? `${average} stars from ${track.ratingCount} ratings` : 'No ratings yet'}, ${saves}`}
          onPress={() => router.push(`/track/${track.id}`)}
          style={({ pressed }) => [styles.rowMain, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.rowArt}>
            <Artwork uri={track.artworkUrl} name={track.title} size={64} />
          </View>
          <View style={{ flex: 1, gap: space[3] }}>
            {why ? (
              <Text numberOfLines={1} style={styles.rowContext}>
                {why}
              </Text>
            ) : null}
            <Text numberOfLines={1} style={styles.rowTitle}>
              {track.title}
            </Text>
            <Text numberOfLines={1} style={s.muted}>
              {track.artistName}
              {track.producerName ? (
                <>
                  {' · prod. '}
                  <Text style={{ color: c.accent }}>{track.producerName}</Text>
                </>
              ) : null}
            </Text>
            <Text numberOfLines={1} style={styles.rowMeta}>
              {average ? (
                <Text style={styles.rowScore}>
                  ★ {average}
                  <Text style={styles.rowMeta}> ({track.ratingCount})</Text>
                </Text>
              ) : (
                'Unrated'
              )}
              {` · ${saves}`}
            </Text>
          </View>
        </Pressable>
        <SaveButton track={track} onError={setSaveError} />
      </View>
      <ErrorLine message={saveError} />
    </View>
  );
}
const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: space[8] },
  filter: {
    minHeight: 36,
    paddingHorizontal: space[14],
    borderRadius: radius.medium,
    backgroundColor: c.panel,
    justifyContent: 'center',
  },
  filterOn: { backgroundColor: c.accent },
  filterText: { color: c.muted, fontSize: fontSize.body, fontWeight: fontWeight.medium },
  rowWrap: {
    paddingVertical: space[14],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.line,
    gap: space[6],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[14] },
  rowContext: {
    color: c.accent,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.caption,
    letterSpacing: tracking.metadata,
    textTransform: 'uppercase',
  },
  rowMeta: { color: c.muted, fontSize: fontSize.label },
  rowScore: { color: c.accent, fontSize: fontSize.label, fontWeight: fontWeight.bold },
  rowArt: { borderRadius: radius.medium, overflow: 'hidden' },
  rowTitle: { color: c.text, fontSize: fontSize.trackTitle, fontWeight: fontWeight.bold },
  cardItem: { paddingVertical: space[8] },
  sectionTitle: {
    flex: 1,
    color: c.text,
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.trackTitle,
    fontWeight: fontWeight.regular,
    letterSpacing: tracking.brand,
  },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space[6] },
  reasonText: { flex: 1, color: c.muted, fontSize: fontSize.label },
});
