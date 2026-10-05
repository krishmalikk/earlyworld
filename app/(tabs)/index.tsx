import { useCommunity } from '../../src/data/community';
import type { Stamp } from '../../src/data/types';
import { fontSize, fontWeight, space } from '../../shared/theme';
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
import type { Follow, Rating } from '../../src/data/types';
import { c, Chip, Empty, ErrorLine, Page, s, Section } from '../../src/components/ui';
import { TrackShelf } from '../../src/components/TrackShelf';
import { TrackRow } from '../../src/components/TrackRow';
import { RatingCard } from '../../src/components/Ratings';
import { usePostPage } from '../../src/data/social';
import { PostCard } from '../../src/components/PostCard';
import { VideoFeed } from '../../src/components/VideoFeed';
import type { SocialPost } from '../../shared/social';
import { mergeFeedEntries } from '../../shared/feed';

type Entry = { key: string; trackId: string; at: number; rating?: Rating; post?: SocialPost };
const tabs = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingHorizontal: space[18],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.line,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space[12],
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -StyleSheet.hairlineWidth,
  },
  tabActive: { borderBottomColor: c.accent },
  label: { fontSize: fontSize.navigation },
});
export default function Feed() {
  const [view, setView] = useState('Feed');
  return (
    <View style={s.page}>
      <View style={tabs.bar}>
        {['Feed', 'Videos'].map((label) => {
          const selected = view === label;
          return (
            <Pressable
              key={label}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setView(label)}
              style={[tabs.tab, selected && tabs.tabActive]}
            >
              <Text
                style={[
                  tabs.label,
                  {
                    color: selected ? c.text : c.muted,
                    fontWeight: selected ? fontWeight.bold : fontWeight.medium,
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {view === 'Videos' ? <VideoFeed /> : <Timeline />}
    </View>
  );
}
function Timeline() {
  const uid = useLocal((s) => s.uid),
    { user } = useSession(),
    active = useForeground();
  const [filter, setFilter] = useState('All activity');
  const posts = usePostPage({ mode: 'following' }, filter !== 'Ratings & reviews');
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
            filter === 'Ratings & reviews' ? (entry) => !!entry.rating : undefined,
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
      filter === 'Ratings & reviews'
        ? []
        : saves.data.map((save) => ({
            key: `save:${save.id}`,
            trackId: save.trackId,
            at: save.savedAt?.toMillis() || 0,
          })),
    ],
    page,
    filter === 'Ratings & reviews' ? (entry) => !!entry.rating : undefined,
  );
  const fallback = useCatalogPage('tracks', {
    scenes: user?.scenes || [],
    enabled: !rows.length && filter !== 'Ratings & reviews',
  });
  const trackData: Entry[] =
    rows.length || filter === 'Ratings & reviews'
      ? rows
      : fallback.data.map((track) => ({
          key: `fallback:${track.id}`,
          trackId: track.id,
          at: 0,
        }));
  const data: Entry[] = mergeFeedEntries(
    [
      filter === 'Posts' ? [] : trackData,
      filter === 'Ratings & reviews'
        ? []
        : posts.data.map((post) => ({
            key: `post:${post.id}`,
            trackId: '',
            at: post.publishedAt,
            post,
          })),
    ],
    page,
  );
  const catalog = useCatalogIds('tracks', data.map((entry) => entry.trackId).filter(Boolean));
  const shelf = useMemo(() => {
    const seen = new Set<string>();
    return data
      .flatMap((entry) => {
        const track = catalog.byId.get(entry.trackId);
        if (!track || seen.has(track.id)) return [];
        seen.add(track.id);
        return [track];
      })
      .slice(0, 8);
  }, [data, catalog.byId]);
  return (
    <Page scroll={false}>
      <FlatList
        contentContainerStyle={[s.body, { gap: space[14] }]}
        data={data}
        keyExtractor={(item) => item.key}
        onEndReached={() => {
          if (posts.more && !posts.loading) posts.loadMore();
          if (data.length >= page) setPage((p) => p + 25);
          if (!rows.length) {
            if (fallback.hasMore && !fallback.loading && !fallback.error) fallback.loadMore();
          }
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ gap: space[20], paddingBottom: space[4] }}>
            {shelf.length ? (
              <Section title="On your radar">
                <TrackShelf tracks={shelf} compact />
              </Section>
            ) : null}
            <View style={s.grid}>
              {['All activity', 'Posts', 'Ratings & reviews'].map((label) => (
                <Chip
                  key={label}
                  label={label}
                  selected={filter === label}
                  onPress={() => setFilter(label)}
                />
              ))}
            </View>
            <ErrorLine
              message={
                (state.key === key ? state.error : null) ||
                posts.error ||
                opinions.error ||
                saves.error ||
                follows.error ||
                catalog.error ||
                fallback.error
              }
            />
          </View>
        }
        renderItem={({ item }) => {
          if (item.post) return <PostCard post={item.post} />;
          if (item.rating) return <RatingCard rating={item.rating} excerpt />;
          const track = catalog.byId.get(item.trackId);
          return track ? <TrackRow track={track} variant="card" /> : null;
        }}
        ListEmptyComponent={
          <Empty
            title={filter === 'Ratings & reviews' ? 'No listener ratings yet.' : 'No activity yet.'}
            detail="Follow artists or listeners to see their activity here."
          />
        }
      />
    </Page>
  );
}
