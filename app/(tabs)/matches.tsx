import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { collection, orderBy, query } from '@react-native-firebase/firestore';
import { useCollection } from '../../src/data/listeners';
import { useLocal } from '../../src/state/local';
import { db } from '../../src/lib/firebase';
import type { Match } from '../../src/data/types';
import { Button, c, Empty, ErrorLine, Heading, Page, s } from '../../src/components/ui';
import { UserLine } from '../../src/components/UserLine';
export default function Matches() {
  const uid = useLocal((s) => s.uid);
  const ref = useMemo(
    () => (uid ? query(collection(db, 'users', uid, 'matches'), orderBy('score', 'desc')) : null),
    [uid],
  );
  const { data, error } = useCollection<Match>(ref, true);
  return (
    <Page>
      <Heading eyebrow="RARE TASTE / SHARED SIGNAL" title="Your kind of people." />
      <Text style={s.muted}>
        A deep cut says more than a hit. These connections start with the tracks almost nobody
        saved.
      </Text>
      <ErrorLine message={error} />
      {data.length ? (
        data.map((match, i) => (
          <View key={match.id} style={s.panel}>
            <View style={s.between}>
              <Text style={[s.mono, { color: c.accent }]}>TASTE CONNECTION</Text>
              <Text style={s.mono}>{String(i + 1).padStart(2, '0')}</Text>
            </View>
            <UserLine uid={match.id} />
            {match.sharedTracks.map((track) => (
              <View
                key={track.trackId}
                style={{ gap: 4, borderTopWidth: 1, borderColor: c.line, paddingTop: 10 }}
              >
                <Text onPress={() => router.push(`/track/${track.trackId}`)} style={s.text}>
                  {track.title} <Text style={s.muted}>/ {track.artistName}</Text>
                </Text>
                <Text style={[s.link, { fontSize: 11 }]}>
                  You're 2 of {track.saveCount} people here who saved this.
                </Text>
              </View>
            ))}
          </View>
        ))
      ) : (
        <>
          <Empty
            title="Save a few more tracks to find your people"
            detail="Connections refresh as you save. Your taste stays open."
          />
          <Button quiet onPress={() => router.push('/(tabs)/discover')}>
            Explore the catalog
          </Button>
        </>
      )}
    </Page>
  );
}
