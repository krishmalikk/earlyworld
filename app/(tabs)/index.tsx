import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
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
import { useCatalog } from '../../src/data/catalog';
import { useCollection, useForeground } from '../../src/data/listeners';
import type { Follow, Track } from '../../src/data/types';
import { c, Empty, ErrorLine, Heading, Page, s } from '../../src/components/ui';
import { TrackRow } from '../../src/components/TrackRow';
export default function Feed() {
  const uid = useLocal((x) => x.uid),
    { user } = useSession(),
    catalog = useCatalog(),
    active = useForeground();
  const [page, setPage] = useState(25),
    [rows, setRows] = useState<{ trackId: string; at: number; context: string }[]>([]),
    [error, setError] = useState<string | null>(null);
  const followingRef = useMemo(
    () => (uid ? collection(db, 'users', uid, 'following') : null),
    [uid],
  );
  const follows = useCollection<Follow>(followingRef, true);
  const key = follows.data
    .map((f) => `${f.targetType}:${f.id}`)
    .sort()
    .join('|');
  useEffect(() => {
    if (!active || !uid) return;
    const streams = new Map<number, typeof rows>();
    const unsubscribes: (() => void)[] = [];
    let index = 0;
    function publish() {
      const unique = new Map<string, (typeof rows)[number]>();
      [...streams.values()]
        .flat()
        .sort((a, b) => b.at - a.at)
        .forEach((row) => {
          if (!unique.has(row.trackId)) unique.set(row.trackId, row);
        });
      setRows([...unique.values()].slice(0, page));
    }
    for (const type of ['user', 'artist', 'producer'] as const) {
      const ids = follows.data.filter((f) => f.targetType === type).map((f) => f.id);
      for (let offset = 0; offset < ids.length; offset += 30) {
        const stream = index++,
          isUser = type === 'user';
        const ref = query(
          collection(db, isUser ? 'activity' : 'tracks'),
          where(
            isUser ? 'actorUid' : type === 'artist' ? 'artistId' : 'producerId',
            'in',
            ids.slice(offset, offset + 30),
          ),
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
                  trackId: isUser ? d.data().trackId : d.id,
                  at: d.data()[isUser ? 'savedAt' : 'createdAt']?.toMillis() || 0,
                  context: isUser ? 'SAVED BY SOMEONE YOU FOLLOW' : 'FROM YOUR FOLLOWED CATALOG',
                })),
              );
              publish();
            },
            (e) => setError(errorMessage(e)),
          ),
        );
      }
    }
    if (!index) setRows([]);
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [uid, key, page, active]);
  const fallback = catalog.tracks
    .filter((t) =>
      catalog.artists.some(
        (a) => a.id === t.artistId && a.scenes?.some((scene) => user?.scenes.includes(scene)),
      ),
    )
    .sort((a, b) => a.saveCount - b.saveCount)
    .slice(0, page);
  const data = rows.length
    ? rows
        .map((r) => ({ track: catalog.tracks.find((t) => t.id === r.trackId), context: r.context }))
        .filter((r): r is { track: Track; context: string } => !!r.track)
    : fallback.map((track) => ({ track, context: 'FROM YOUR SCENES' }));
  return (
    <Page scroll={false}>
      <FlatList
        contentContainerStyle={s.body}
        data={data}
        keyExtractor={(item) => item.track.id}
        onEndReached={() => {
          if (data.length >= page) setPage((p) => p + 25);
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ gap: 15 }}>
            <Heading
              eyebrow="SIGNAL FROM YOUR CIRCLE"
              title="In the loop."
              right={<Text style={[s.mono, { color: c.accent }]}>● LIVE</Text>}
            />
            <Text style={s.muted}>Recent saves and releases from the people you follow.</Text>
            <ErrorLine message={error || follows.error || catalog.error} />
          </View>
        }
        renderItem={({ item }) => <TrackRow track={item.track} context={item.context} />}
        ListEmptyComponent={
          <Empty
            title="Find something worth passing on."
            detail="Follow artists and people to bring their tracks here."
          />
        }
        ListFooterComponent={
          <Text style={[s.mono, { paddingTop: 18, fontSize: 8 }]}>
            {data.length < page ? 'CAUGHT UP / KEEP DIGGING' : 'SCROLL TO LOAD MORE'}
          </Text>
        }
      />
    </Page>
  );
}
