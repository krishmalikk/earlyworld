import { fontSize, radius, space } from '../../shared/theme';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { collection, orderBy, query } from '@react-native-firebase/firestore';
import { useCollection } from '../../src/data/listeners';
import { useLocal } from '../../src/state/local';
import { db, call, errorMessage } from '../../src/lib/firebase';
import { useSession } from '../../src/data/session';
import { useCatalogIds } from '../../src/data/catalog';
import type { Match } from '../../src/data/types';
import { Artwork, Button, c, Empty, ErrorLine, Heading, Page, s } from '../../src/components/ui';
import { UserLine } from '../../src/components/UserLine';
export default function Matches() {
  const uid = useLocal((s) => s.uid);
  const { user, loading: profileLoading } = useSession();
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  async function findMatches() {
    setBusy(true);
    setRequestError(null);
    try {
      await call('computeMatches');
    } catch (error) {
      setRequestError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const ref = useMemo(
    () => (uid ? query(collection(db, 'users', uid, 'matches'), orderBy('score', 'desc')) : null),
    [uid],
  );
  const { data, loading, error } = useCollection<Match>(ref, true);
  const trackIds = useMemo(
    () => data.flatMap((match) => match.sharedTracks.map((track) => track.trackId)),
    [data],
  );
  const catalog = useCatalogIds('tracks', trackIds);
  return (
    <Page>
      <Heading
        eyebrow="Matches"
        title="Shared taste"
        right={
          data.length ? (
            <View style={styles.countPill}>
              <Text style={styles.countText}>
                {data.length} {data.length === 1 ? 'match' : 'matches'}
              </Text>
            </View>
          ) : undefined
        }
      />
      <ErrorLine message={error || requestError} />
      {loading || profileLoading ? (
        <Empty title="Loading connections…" />
      ) : data.length ? (
        data.map((match) => (
          <View key={match.id} style={s.panel}>
            <UserLine
              uid={match.id}
              detail={`${match.sharedTracks.length} shared track${
                match.sharedTracks.length === 1 ? '' : 's'
              }`}
            />
            {match.sharedTracks.map((track) => (
              <View
                key={track.trackId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[10],
                  borderTopWidth: 1,
                  borderColor: c.line,
                  paddingTop: space[10],
                }}
              >
                <View style={{ borderRadius: radius.medium, overflow: 'hidden' }}>
                  <Artwork
                    uri={catalog.byId.get(track.trackId)?.artworkUrl}
                    name={track.title}
                    size={44}
                  />
                </View>
                <View style={{ flex: 1, gap: space[4] }}>
                  <Text onPress={() => router.push(`/track/${track.trackId}`)} style={s.text}>
                    {track.title} <Text style={s.muted}>/ {track.artistName}</Text>
                  </Text>
                  <Text style={[s.link, { fontSize: fontSize.smallLabel }]}>
                    You both saved this · {track.saveCount} saves
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))
      ) : error ? null : (
        <>
          <Empty
            title={
              user?.initialMatchesComputed
                ? 'No shared-track matches yet.'
                : 'Your profile is ready.'
            }
            detail={
              user?.initialMatchesComputed
                ? 'Matches appear when other listeners save the same tracks.'
                : 'Find listeners who save the same tracks.'
            }
          />
          {!user?.initialMatchesComputed ? (
            <Button busy={busy} busyLabel="Finding matches…" onPress={findMatches}>
              Find matches
            </Button>
          ) : null}
          <Button quiet onPress={() => router.push('/(tabs)/discover')}>
            Explore the catalog
          </Button>
        </>
      )}
    </Page>
  );
}
const styles = StyleSheet.create({
  countPill: {
    backgroundColor: c.selected,
    borderRadius: radius.pill,
    paddingHorizontal: space[12],
    paddingVertical: space[6],
  },
  countText: { color: c.text, fontSize: fontSize.smallLabel },
});
