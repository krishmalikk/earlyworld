import { useCommunity } from '../data/community';
import { useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { collection, doc, limit, orderBy, query } from '@react-native-firebase/firestore';
import { router } from 'expo-router';
import { fontSize, fontWeight, radius, space } from '../../shared/theme';
import { useLocal } from '../state/local';
import { useCatalogPage } from '../data/catalog';
import { useCollection, useDocument } from '../data/listeners';
import { follow } from '../data/actions';
import { call, db, errorMessage } from '../lib/firebase';
import type { Entity, Follow, Production, Rotation, Track } from '../data/types';
import { Artwork, Button, c, Chip, Empty, ErrorLine, Page, s, Section, TierBadge } from './ui';
import { UserLine } from './UserLine';
import { TrackRow } from './TrackRow';
import { WaveBackground } from './AuthDecor';

type Row = { id: string; track: Track } | { id: string; production: Production };
export function ProducerProfile({ id }: { id: string }) {
  const uid = useLocal((state) => state.uid);
  const [mode, setMode] = useState('Genius credits'),
    [count, setCount] = useState(25);
  const [syncing, setSyncing] = useState(false),
    [followingBusy, setFollowingBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const refs = useMemo(
    () => ({
      entity: doc(db, 'producers', id),
      follow: uid ? doc(db, 'users', uid, 'following', id) : null,
      mine: uid ? doc(db, 'users', uid, 'rotation', id) : null,
    }),
    [id, uid],
  );
  const productionsRef = useMemo(
    () => query(collection(db, 'producers', id, 'productions'), orderBy('title'), limit(count)),
    [id, count],
  );
  const entity = useDocument<Entity>(refs.entity),
    productions = useCollection<Production>(productionsRef),
    following = useDocument<Follow>(refs.follow),
    mine = useDocument<Rotation>(refs.mine);
  const catalog = useCatalogPage('tracks', {
    producerName: entity.data?.name,
    enabled: !!entity.data?.name && mode === 'In earlyworld',
  });
  const tracks = catalog.data;
  const linked = useCatalogPage('tracks', {
    geniusIds: productions.data.map((p) => p.geniusId),
    enabled: mode === 'Genius credits' && productions.data.length > 0,
  });
  const byGenius = useMemo(
    () =>
      new Map(
        linked.data.filter((track) => track.geniusId).map((track) => [track.geniusId, track]),
      ),
    [linked.data],
  );
  const rows: Row[] =
    mode === 'In earlyworld'
      ? tracks.map((track) => ({ id: track.id, track }))
      : productions.data.map((production) => ({ id: production.id, production }));
  const sync = entity.data?.geniusSync;
  async function loadCredits() {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    try {
      await call('syncProducerCredits', { producerId: id });
      setCount((value) => value + 25);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSyncing(false);
    }
  }
  async function open(url: string) {
    try {
      await Linking.openURL(url);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <Page scroll={false}>
      <WaveBackground veil={false} />
      <FlatList<Row>
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={[s.body, { gap: space[12] }]}
        initialNumToRender={12}
        windowSize={7}
        ListHeaderComponent={
          <View style={{ gap: space[20], paddingBottom: space[8] }}>
            <View style={styles.hero}>
              <View style={styles.avatar}>
                <Artwork
                  uri={entity.data?.imageUrl}
                  name={entity.data?.name || 'Producer'}
                  size={92}
                />
              </View>
              <Text style={s.mono}>Producer</Text>
              <Text accessibilityRole="header" style={[s.title, { textAlign: 'center' }]}>
                {entity.data?.name || 'Producer profile'}
              </Text>
              {entity.data?.biography ? (
                <Text numberOfLines={3} style={[s.text, { textAlign: 'center' }]}>
                  {entity.data.biography}
                </Text>
              ) : null}
              <TierBadge tier={mine.data?.tier || null} />
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.number}>{entity.data?.trackCount || tracks.length}</Text>
                  <Text style={s.muted}>In earlyworld</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.number}>
                    {sync?.verifiedCount || 0}
                    {sync && !sync.complete ? '+' : ''}
                  </Text>
                  <Text style={s.muted}>Genius credits</Text>
                </View>
              </View>
              <View style={{ alignSelf: 'stretch' }}>
                <Button
                  busy={followingBusy}
                  disabled={!uid || following.loading || !!following.error || !entity.data}
                  onPress={async () => {
                    if (!uid || followingBusy) return;
                    setFollowingBusy(true);
                    setError(null);
                    try {
                      await follow(uid, id, 'producer', !!following.data);
                    } catch (e) {
                      setError(errorMessage(e));
                    } finally {
                      setFollowingBusy(false);
                    }
                  }}
                >
                  {following.data ? 'Following · unfollow' : 'Follow producer'}
                </Button>
              </View>
              {entity.data?.geniusUrl ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void open(entity.data!.geniusUrl!)}
                  style={styles.link}
                >
                  <Text style={s.link}>Profile & biography on Genius ↗</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={s.grid}>
              {['Genius credits', 'In earlyworld'].map((label) => (
                <Chip
                  key={label}
                  label={label}
                  selected={mode === label}
                  onPress={() => setMode(label)}
                />
              ))}
            </View>
            {mode === 'Genius credits' ? (
              <View style={{ gap: space[8] }}>
                <Text
                  style={{ color: c.text, fontSize: fontSize.section, fontWeight: fontWeight.bold }}
                >
                  Produced by {entity.data?.name || 'this producer'}
                </Text>
                <Text style={s.muted}>
                  Production credits from Genius, including co-productions. Tracks outside
                  earlyworld open on Genius.
                </Text>
                {sync?.updatedAt ? (
                  <Text style={s.muted}>
                    Updated {sync.updatedAt.toDate().toLocaleDateString()}
                    {sync.complete ? ' · All available pages checked' : ' · More credits to check'}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={s.muted}>Catalog tracks, including shared production credits.</Text>
            )}
            <ErrorLine
              message={
                error || entity.error || productions.error || following.error || catalog.error
              }
            />
          </View>
        }
        renderItem={({ item }) => {
          if ('track' in item) return <TrackRow track={item.track} />;
          const production = item.production,
            track = byGenius.get(production.geniusId);
          return (
            <Pressable
              accessibilityRole={track ? 'button' : 'link'}
              accessibilityLabel={`${production.title} by ${production.artistName}, ${track ? 'view track' : 'open on Genius'}`}
              onPress={() =>
                track ? router.push(`/track/${track.id}`) : void open(production.geniusUrl)
              }
              style={styles.credit}
            >
              <View style={{ borderRadius: radius.medium, overflow: 'hidden' }}>
                <Artwork uri={production.artworkUrl} name={production.title} size={60} />
              </View>
              <View style={{ flex: 1, gap: space[5] }}>
                <Text numberOfLines={2} style={[s.text, { fontWeight: fontWeight.bold }]}>
                  {production.title}
                </Text>
                <Text numberOfLines={1} style={s.muted}>
                  {production.artistName}
                </Text>
                <Text style={s.link}>
                  {[production.releaseDate?.slice(0, 4), track ? 'In earlyworld' : 'Genius ↗']
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Empty
            title={
              productions.loading || entity.loading
                ? 'Loading producer…'
                : mode === 'Genius credits'
                  ? 'No verified credits loaded yet.'
                  : 'No catalog tracks yet.'
            }
            detail={
              mode === 'Genius credits'
                ? 'Load credits below, or browse tracks already in earlyworld.'
                : undefined
            }
          />
        }
        ListFooterComponent={
          <View style={{ gap: space[24] }}>
            {mode === 'Genius credits' ? (
              <View style={{ gap: space[12], paddingTop: space[12] }}>
                {(sync?.verifiedCount || 0) > productions.data.length || !sync?.complete ? (
                  <Button
                    busy={syncing}
                    busyLabel="Checking production credits…"
                    disabled={!entity.data || productions.loading}
                    onPress={() => {
                      if ((sync?.verifiedCount || 0) > productions.data.length)
                        setCount((value) => value + 25);
                      else void loadCredits();
                    }}
                  >
                    {productions.data.length ? 'Load more productions' : 'Load productions'}
                  </Button>
                ) : null}
                <ErrorLine message={error} />
              </View>
            ) : null}
            {mode === 'In earlyworld' && catalog.hasMore ? (
              <Button quiet busy={catalog.loading} onPress={catalog.loadMore}>
                Load more tracks
              </Button>
            ) : null}
            <ProducerListeners id={id} />
          </View>
        }
      />
    </Page>
  );
}
const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    backgroundColor: c.panel,
    borderRadius: radius.card,
    padding: space[20],
    gap: space[14],
  },
  avatar: { borderWidth: 2, borderColor: c.accent, borderRadius: radius.pill, overflow: 'hidden' },
  stats: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    backgroundColor: c.bg,
    borderRadius: radius.large,
    padding: space[14],
  },
  stat: { flex: 1, alignItems: 'center', gap: space[4] },
  number: { color: c.text, fontSize: fontSize.section, fontWeight: fontWeight.bold },
  credit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    padding: space[12],
    backgroundColor: c.panel,
    borderRadius: radius.large,
  },
  link: { minHeight: 44, justifyContent: 'center' },
});

function ProducerListeners({ id }: { id: string }) {
  const leaders = useCommunity<Rotation>({ kind: 'leaders', itemId: id }, 20);
  const certified = leaders.data.filter((entry) => entry.tier);
  return (
    <Section title="Certified listeners">
      <ErrorLine message={leaders.error} />
      {certified.map((entry) => (
        <View key={entry.uid} style={s.panel}>
          <TierBadge tier={entry.tier} />
          <UserLine uid={entry.uid} />
        </View>
      ))}
      {!leaders.loading && !certified.length ? <Empty title="No certifications yet." /> : null}
    </Section>
  );
}
