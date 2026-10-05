import { fontSize, radius, space } from '../shared/theme';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { call, errorMessage } from '../src/lib/firebase';
import { useSession } from '../src/data/session';
import { useCatalogIds } from '../src/data/catalog';
import { useMatches } from '../src/data/inbox';
import { openConversation } from '../src/data/messages';
import { useSocialStatus } from '../src/data/social';
import { Artwork, Button, c, Empty, ErrorLine, Heading, Page, s } from '../src/components/ui';
import { UserLine } from '../src/components/UserLine';
import { SmallButton } from '../src/components/Messages';
export default function Matches() {
  const { user, loading: profileLoading } = useSession();
  const messaging = useSocialStatus().data?.messaging === true;
  const [busy, setBusy] = useState(false),
    [opening, setOpening] = useState<string | null>(null);
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
  async function message(id: string) {
    setOpening(id);
    setRequestError(null);
    try {
      router.push(`/messages/${await openConversation([id])}`);
    } catch (error) {
      setRequestError(errorMessage(error));
    } finally {
      setOpening(null);
    }
  }
  const { data, loading, error } = useMatches();
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
      <Text style={s.muted}>
        Listeners who saved the same rare tracks as you, ranked by how few others found them.
      </Text>
      <ErrorLine message={error || requestError} />
      {loading || profileLoading ? (
        <Empty title="Loading connections…" />
      ) : data.length ? (
        data.map((match) => (
          <View key={match.id} style={s.panel}>
            <View style={s.between}>
              <View style={{ flex: 1 }}>
                <UserLine
                  uid={match.id}
                  detail={`${match.sharedTracks.length} shared track${
                    match.sharedTracks.length === 1 ? '' : 's'
                  }`}
                />
              </View>
              {messaging ? (
                <SmallButton
                  label={opening === match.id ? 'Opening…' : 'Message'}
                  disabled={!!opening}
                  onPress={() => void message(match.id)}
                />
              ) : null}
            </View>
            {match.sharedTracks.map((track) => (
              <Pressable
                key={track.trackId}
                accessibilityRole="link"
                accessibilityLabel={`${track.title} by ${track.artistName}`}
                onPress={() => router.push(`/track/${track.trackId}`)}
                style={styles.track}
              >
                <View style={{ borderRadius: radius.medium, overflow: 'hidden' }}>
                  <Artwork
                    uri={catalog.byId.get(track.trackId)?.artworkUrl}
                    name={track.title}
                    size={44}
                  />
                </View>
                <View style={{ flex: 1, gap: space[4] }}>
                  <Text style={s.text}>
                    {track.title} <Text style={s.muted}>/ {track.artistName}</Text>
                  </Text>
                  <Text style={[s.link, { fontSize: fontSize.smallLabel }]}>
                    You both saved this · {track.saveCount} saves
                  </Text>
                </View>
              </Pressable>
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
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[10],
    borderTopWidth: 1,
    borderColor: c.line,
    paddingTop: space[10],
    minHeight: 44,
  },
});
