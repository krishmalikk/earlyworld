import { useCommunity } from '../data/community';
import { useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { collection, doc, limit, orderBy, query } from '@react-native-firebase/firestore';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSize, fontWeight, lineHeight, radius, space, tracking } from '../../shared/theme';
import { useLocal } from '../state/local';
import { useCatalogPage } from '../data/catalog';
import { useCollection, useDocument } from '../data/listeners';
import { follow } from '../data/actions';
import { call, db, errorMessage } from '../lib/firebase';
import type { Entity, Follow, Production, Rotation, Track } from '../data/types';
import { Artwork, Button, c, Empty, ErrorLine, s, Section, Segmented, TierBadge } from './ui';
import { UserLine } from './UserLine';
import { TrackRow } from './TrackRow';
import { WaveBackground } from './AuthDecor';

type Row = { id: string; track: Track } | { id: string; production: Production };
export function ProducerProfile({ id }: { id: string }) {
  const uid = useLocal((state) => state.uid);
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('Genius credits'),
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
  const name = entity.data?.name || 'Producer';
  const genius = `${sync?.verifiedCount || 0}${sync && !sync.complete ? '+' : ''}`;
  return (
    <View style={s.page}>
      <WaveBackground veil={false} />
      <FlatList<Row>
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{ flexGrow: 1 }}
        initialNumToRender={12}
        windowSize={7}
        ListHeaderComponent={
          <>
            <View style={[styles.hero, { paddingTop: insets.top + space[8] }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                style={({ pressed }) => [styles.back, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="chevron-back" size={20} color={c.text} />
              </Pressable>
              <View style={styles.avatar}>
                <View style={styles.avatarInner}>
                  <Artwork uri={entity.data?.imageUrl} name={name} size={AVATAR} />
                </View>
              </View>
              <View style={{ gap: space[8] }}>
                <Text accessibilityRole="header" numberOfLines={2} style={styles.name}>
                  {entity.data?.name || (entity.loading ? ' ' : 'Producer profile')}
                </Text>
                <Text style={styles.meta}>
                  Producer ·{' '}
                  <Text style={styles.metaNumber}>
                    {(entity.data?.trackCount || tracks.length).toLocaleString()}
                  </Text>{' '}
                  in earlyworld · <Text style={styles.metaNumber}>{genius}</Text> on Genius
                </Text>
                {mine.data?.tier ? <TierBadge tier={mine.data.tier} /> : null}
              </View>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: !!following.data, busy: followingBusy }}
                  disabled={
                    !uid || followingBusy || following.loading || !!following.error || !entity.data
                  }
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
                  style={({ pressed }) => [
                    styles.pill,
                    following.data ? styles.pillOutline : styles.pillFilled,
                    { opacity: pressed || followingBusy ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.pillText, { color: following.data ? c.text : c.bg }]}>
                    {following.data ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
                {entity.data?.geniusUrl ? (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Profile and biography on Genius"
                    onPress={() => void open(entity.data!.geniusUrl!)}
                    style={({ pressed }) => [
                      styles.pill,
                      styles.pillOutline,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={[styles.pillText, { color: c.accent }]}>Bio on Genius</Text>
                    <Ionicons
                      name="arrow-up-outline"
                      size={14}
                      color={c.accent}
                      style={styles.northEast}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>
            <View style={styles.sheetTop}>
              <Segmented subtle options={MODES} value={mode} onChange={setMode} />
              <View style={s.between}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {mode === 'Genius credits' ? `Produced by ${name}` : `${name} in earlyworld`}
                </Text>
                {mode === 'Genius credits' && sync?.updatedAt ? (
                  <Text style={styles.updated}>
                    Updated{' '}
                    {sync.updatedAt
                      .toDate()
                      .toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                  </Text>
                ) : null}
              </View>
              <ErrorLine
                message={
                  error || entity.error || productions.error || following.error || catalog.error
                }
              />
            </View>
          </>
        }
        renderItem={({ item }) => {
          if ('track' in item)
            return (
              <View style={styles.sheetRow}>
                <TrackRow track={item.track} />
              </View>
            );
          const production = item.production,
            track = byGenius.get(production.geniusId);
          return (
            <View style={styles.sheetRow}>
              <Pressable
                accessibilityRole={track ? 'button' : 'link'}
                accessibilityLabel={`${production.title} by ${production.artistName}, ${track ? 'view track' : 'open on Genius'}`}
                onPress={() =>
                  track ? router.push(`/track/${track.id}`) : void open(production.geniusUrl)
                }
                style={({ pressed }) => [styles.credit, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={styles.creditArt}>
                  <Artwork uri={production.artworkUrl} name={production.title} size={56} />
                </View>
                <View style={{ flex: 1, gap: space[2] }}>
                  <Text numberOfLines={2} style={styles.creditTitle}>
                    {production.title}
                  </Text>
                  <Text numberOfLines={1} style={s.muted}>
                    {production.artistName}
                    {track ? ' · In earlyworld' : ''}
                  </Text>
                </View>
                <Ionicons
                  name={track ? 'chevron-forward' : 'arrow-up-outline'}
                  size={18}
                  color={c.muted}
                  style={track ? undefined : styles.northEast}
                />
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.sheetRow}>
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
          </View>
        }
        ListFooterComponent={
          <View style={[styles.sheetFooter, { paddingBottom: insets.bottom + space[30] }]}>
            {mode === 'Genius credits' &&
            ((sync?.verifiedCount || 0) > productions.data.length || !sync?.complete) ? (
              <Button
                quiet
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
            {mode === 'In earlyworld' && catalog.hasMore ? (
              <Button quiet busy={catalog.loading} onPress={catalog.loadMore}>
                Load more tracks
              </Button>
            ) : null}
            <ProducerListeners id={id} />
          </View>
        }
        ListFooterComponentStyle={{ flexGrow: 1 }}
      />
    </View>
  );
}
const MODES = [
  { value: 'Genius credits', label: 'Genius credits' },
  { value: 'In earlyworld', label: 'In earlyworld' },
] as const;
type Mode = (typeof MODES)[number]['value'];
const AVATAR = 112;
const styles = StyleSheet.create({
  hero: { paddingHorizontal: space[18], paddingBottom: space[28], gap: space[18] },
  back: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    alignSelf: 'flex-start',
    borderWidth: 3,
    borderColor: c.accent,
    borderRadius: radius.pill,
    padding: space[3],
    backgroundColor: c.bg,
  },
  avatarInner: { borderRadius: radius.pill, overflow: 'hidden' },
  name: {
    color: c.text,
    fontSize: fontSize.brandHero,
    fontWeight: fontWeight.heavy,
    letterSpacing: tracking.title,
  },
  meta: { color: c.muted, fontSize: fontSize.body, lineHeight: lineHeight.content },
  metaNumber: { color: c.text, fontWeight: fontWeight.bold },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[10] },
  pill: {
    minHeight: 44,
    paddingHorizontal: space[22],
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[6],
  },
  pillFilled: { backgroundColor: c.accent, borderColor: c.accent },
  pillOutline: { backgroundColor: c.panel, borderColor: c.line },
  pillText: { fontSize: fontSize.body, fontWeight: fontWeight.bold },
  northEast: { transform: [{ rotate: '45deg' }] },
  sheetTop: {
    backgroundColor: c.panel,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: c.line,
    paddingHorizontal: space[18],
    paddingTop: space[18],
    paddingBottom: space[10],
    gap: space[18],
  },
  sheetTitle: {
    flex: 1,
    color: c.text,
    fontSize: fontSize.section,
    fontWeight: fontWeight.heavy,
    letterSpacing: tracking.brand,
  },
  updated: { color: c.muted, fontSize: fontSize.label },
  sheetRow: {
    backgroundColor: c.panel,
    paddingHorizontal: space[18],
    paddingVertical: space[6],
  },
  sheetFooter: {
    flexGrow: 1,
    backgroundColor: c.panel,
    paddingHorizontal: space[18],
    paddingTop: space[18],
    gap: space[24],
  },
  credit: { flexDirection: 'row', alignItems: 'center', gap: space[14], minHeight: 56 },
  creditArt: { borderRadius: radius.large, overflow: 'hidden' },
  creditTitle: { color: c.text, fontSize: fontSize.body, fontWeight: fontWeight.bold },
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
