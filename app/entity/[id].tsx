import { useCommunity } from '../../src/data/community';
import { space } from '../../shared/theme';
import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { doc } from '@react-native-firebase/firestore';
import { db, errorMessage } from '../../src/lib/firebase';
import { useDocument } from '../../src/data/listeners';
import { useCatalogPage } from '../../src/data/catalog';
import { useLocal } from '../../src/state/local';
import { follow } from '../../src/data/actions';
import type { Entity, Follow, Rotation, Track } from '../../src/data/types';
import {
  Artwork,
  Button,
  Empty,
  ErrorLine,
  Heading,
  Page,
  s,
  Section,
  TierBadge,
} from '../../src/components/ui';
import { TrackRow } from '../../src/components/TrackRow';
import { ArtistReleases } from '../../src/components/Releases';
import { ProducerProfile } from '../../src/components/ProducerProfile';
import { UserLine } from '../../src/components/UserLine';
export default function EntityProfile() {
  const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
  const uid = useLocal((state) => state.uid);
  return (
    <>
      <Stack.Screen options={{ title: type === 'producer' ? 'Producer' : 'Artist' }} />
      {type === 'producer' ? (
        <ProducerProfile key={`${uid}:${id}`} id={id} />
      ) : (
        <ArtistProfile key={id} id={id} />
      )}
    </>
  );
}
function ArtistProfile({ id }: { id: string }) {
  const type: 'artist' | 'producer' = 'artist';
  const uid = useLocal((state) => state.uid);
  const [error, setError] = useState<string | null>(null);
  const refs = useMemo(
    () => ({
      entity: doc(db, 'artists', id),
      mine: uid ? doc(db, 'users', uid, 'rotation', id) : null,
      follow: uid ? doc(db, 'users', uid, 'following', id) : null,
    }),
    [id, type, uid],
  );
  const entity = useDocument<Entity>(refs.entity),
    tracks = useCatalogPage('tracks', { artistId: id }),
    leaders = useCommunity<Rotation>({ kind: 'leaders', itemId: id }, 20),
    mine = useDocument<Rotation>(refs.mine),
    following = useDocument<Follow>(refs.follow);
  return (
    <Page scroll={false}>
      <FlatList<Track>
        data={tracks.data}
        keyExtractor={(track) => track.id}
        contentContainerStyle={[s.body, { gap: space[0] }]}
        onEndReached={() => {
          if (tracks.hasMore && !tracks.loading && !tracks.error) tracks.loadMore();
        }}
        initialNumToRender={12}
        windowSize={7}
        renderItem={({ item }) => <TrackRow track={item} />}
        ListHeaderComponent={
          <View style={{ gap: space[18] }}>
            <View style={s.panel}>
              <Heading eyebrow={'Artist'} title={entity.data?.name || 'Loading catalog…'} />
            </View>
            <View style={s.row}>
              <Artwork uri={entity.data?.imageUrl} name={entity.data?.name || 'ew'} size={70} />
              <View style={{ gap: space[10], flex: 1 }}>
                <Text style={s.muted}>{entity.data?.scenes?.join(' / ')}</Text>
                <Text style={s.mono}>{entity.data?.trackCount || tracks.data.length} tracks</Text>
                <TierBadge tier={mine.data?.tier || null} />
              </View>
            </View>
            {uid ? (
              <Button
                quiet
                onPress={async () => {
                  try {
                    await follow(uid, id, type, !!following.data);
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              >
                {following.data ? 'Following · unfollow' : `Follow ${type}`}
              </Button>
            ) : null}
            <ErrorLine message={error || entity.error || tracks.error || leaders.error} />
            <ArtistReleases artistId={id} />
            <Text style={[s.mono, { paddingVertical: space[16] }]}>{'ALL TRACKS'}</Text>
          </View>
        }
        ListEmptyComponent={<Empty title="No tracks yet." />}
        ListFooterComponent={
          <Section title="CERTIFIED LISTENERS">
            {tracks.hasMore ? (
              <Button quiet busy={tracks.loading} onPress={tracks.loadMore}>
                Load more tracks
              </Button>
            ) : null}
            {leaders.data
              .filter((r) => r.tier)
              .map((entry, i) => (
                <View key={entry.uid} style={s.panel}>
                  <View style={s.between}>
                    <Text style={s.mono}>#{String(i + 1).padStart(2, '0')}</Text>
                    <TierBadge tier={entry.tier} />
                  </View>
                  <UserLine uid={entry.uid} />
                </View>
              ))}
            {!leaders.data.some((r) => r.tier) ? <Empty title="No certifications yet." /> : null}
          </Section>
        }
      />
    </Page>
  );
}
