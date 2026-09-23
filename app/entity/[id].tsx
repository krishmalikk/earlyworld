import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  collection,
  collectionGroup,
  doc,
  limit,
  orderBy,
  query,
  where,
} from '@react-native-firebase/firestore';
import { db, errorMessage } from '../../src/lib/firebase';
import { useCollection, useDocument } from '../../src/data/listeners';
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
import { UserLine } from '../../src/components/UserLine';
export default function EntityProfile() {
  const { id, type: rawType } = useLocalSearchParams<{ id: string; type: string }>(),
    type = rawType === 'producer' ? 'producer' : 'artist',
    uid = useLocal((s) => s.uid);
  const [error, setError] = useState<string | null>(null);
  const refs = useMemo(
    () => ({
      entity: doc(db, type === 'producer' ? 'producers' : 'artists', id),
      tracks: query(
        collection(db, 'tracks'),
        where(type === 'producer' ? 'producerId' : 'artistId', '==', id),
        orderBy('createdAt', 'desc'),
      ),
      leaderboard: query(
        collectionGroup(db, 'rotation'),
        where('entityId', '==', id),
        orderBy('score', 'desc'),
        limit(20),
      ),
      mine: uid ? doc(db, 'users', uid, 'rotation', id) : null,
      follow: uid ? doc(db, 'users', uid, 'following', id) : null,
    }),
    [id, type, uid],
  );
  const entity = useDocument<Entity>(refs.entity),
    tracks = useCollection<Track>(refs.tracks),
    leaders = useCollection<Rotation>(refs.leaderboard),
    mine = useDocument<Rotation>(refs.mine),
    following = useDocument<Follow>(refs.follow);
  return (
    <Page>
      <Heading
        eyebrow={type === 'producer' ? 'BEHIND THE SOUND / PRODUCER' : 'IN THE CATALOG / ARTIST'}
        title={entity.data?.name || 'Loading catalog…'}
      />
      <View style={s.row}>
        <Artwork uri={entity.data?.imageUrl} name={entity.data?.name || 'ew'} size={70} />
        <View style={{ gap: 10, flex: 1 }}>
          <Text style={s.muted}>
            {entity.data?.scenes?.join(' / ') || 'The sound starts here.'}
          </Text>
          <Text style={s.mono}>{tracks.data.length} tracks in the catalog</Text>
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
      <Section title={type === 'producer' ? 'PRODUCTION CATALOG' : 'ALL TRACKS'}>
        {tracks.data.map((track, i) => (
          <TrackRow key={track.id} track={track} index={i} />
        ))}
        {!tracks.data.length ? <Empty title="More tracks to come." /> : null}
      </Section>
      <Section title="HEAVY ROTATION / CERTIFIED LISTENERS">
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
        {!leaders.data.some((r) => r.tier) ? (
          <Empty
            title="No certifications yet."
            detail="Breadth, time, and deep cuts. This takes listening."
          />
        ) : null}
      </Section>
    </Page>
  );
}
