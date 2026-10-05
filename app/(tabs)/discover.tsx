import { space } from '../../shared/theme';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { ReleaseCard, ReleaseCatalogLoader } from '../../src/components/Releases';
import { TrackShelf } from '../../src/components/TrackShelf';
import { collection } from '@react-native-firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useLocal } from '../../src/state/local';
import { useCollection } from '../../src/data/listeners';
import { ProducerCard } from '../../src/components/ProducerCard';
import { useCatalogPage } from '../../src/data/catalog';
import { SCENES } from '../../shared/domain';
import {
  Button,
  Chip,
  Empty,
  ErrorLine,
  Field,
  Heading,
  Page,
  s,
  Section,
} from '../../src/components/ui';
import { TrackRow } from '../../src/components/TrackRow';
import { EntityCard } from '../../src/components/EntityCard';
import type { Entity, Follow, Track, Release } from '../../src/data/types';
type Row =
  | { id: string; release: Release }
  | { id: string; track: Track }
  | { id: string; entities: Entity[] };
export default function Discover() {
  const uid = useLocal((state) => state.uid);
  const followingRef = useMemo(
    () => (uid ? collection(db, 'users', uid, 'following') : null),
    [uid],
  );
  const following = useCollection<Follow>(followingRef);
  const followed = useMemo(
    () =>
      new Set(
        following.data.filter((entry) => entry.targetType === 'producer').map((entry) => entry.id),
      ),
    [following.data],
  );
  const [search, setSearch] = useState(''),
    [scene, setScene] = useState(''),
    [mode, setMode] = useState('Tracks');
  const text = search.toLowerCase().trim();
  const kind = mode.toLowerCase() as 'tracks' | 'artists' | 'producers' | 'releases';
  const page = useCatalogPage(kind, { text, scenes: scene ? [scene] : [] });
  const spotlightPage = useCatalogPage('producers', {
    sort: 'popular',
    enabled: mode === 'Tracks' && !text && !scene,
  });
  const result = mode === 'Tracks' ? (page.data as Track[]) : [];
  const entities = mode === 'Artists' || mode === 'Producers' ? (page.data as Entity[]) : [];
  const releaseResult = mode === 'Releases' ? (page.data as Release[]) : [];
  const { error, loading } = page;
  const rows = useMemo<Row[]>(
    () =>
      mode === 'Releases'
        ? releaseResult.map((release) => ({ id: release.id, release }))
        : mode === 'Tracks'
          ? result.map((track) => ({ id: track.id, track }))
          : Array.from({ length: Math.ceil(entities.length / 2) }, (_, i) => ({
              id: entities[i * 2].id,
              entities: entities.slice(i * 2, i * 2 + 2),
            })),
    [mode, result, entities, releaseResult],
  );
  const featured = useMemo(() => {
    const seen = new Set<string>();
    return result
      .filter((track) => {
        if (seen.has(track.artistId)) return false;
        seen.add(track.artistId);
        return true;
      })
      .slice(0, 8);
  }, [result]);
  const spotlight = spotlightPage.data.slice(0, 4);
  const browsing = !text && mode === 'Tracks';
  return (
    <Page scroll={false}>
      <FlatList<Row>
        data={rows}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        contentContainerStyle={[s.body, { gap: space[0] }]}
        ListHeaderComponent={
          <View style={{ gap: space[20], paddingBottom: space[12] }}>
            <View style={{ gap: space[6] }}>
              <Heading title="Find your next favorite." />
              <Text style={s.muted}>Tracks, releases, and the people behind them.</Text>
            </View>
            <Field
              accessibilityLabel="Search catalog"
              placeholder="Track, artist, producer, scene"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            <View style={s.grid}>
              {['Tracks', 'Releases', 'Artists', 'Producers'].map((label) => (
                <Chip
                  key={label}
                  label={label}
                  selected={mode === label}
                  onPress={() => setMode(label)}
                />
              ))}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space[8] }}
            >
              <Chip label="All scenes" selected={!scene} onPress={() => setScene('')} />
              {SCENES.map((label) => (
                <Chip
                  key={label}
                  label={label}
                  selected={scene === label}
                  onPress={() => setScene(label)}
                />
              ))}
            </ScrollView>
            <ErrorLine message={error || spotlightPage.error || following.error} />
            {mode === 'Releases' && !text && !scene ? <ReleaseCatalogLoader key={uid} /> : null}
            {browsing && featured.length ? (
              <Section title={scene || 'Across the underground'}>
                <TrackShelf tracks={featured} />
              </Section>
            ) : null}
            {browsing && !scene && spotlight.length ? (
              <Section
                title="Producer spotlight"
                right={
                  <Button quiet onPress={() => setMode('Producers')}>
                    View all
                  </Button>
                }
              >
                <View style={s.grid}>
                  {spotlight.map((producer) => (
                    <ProducerCard
                      key={producer.id}
                      producer={producer}
                      followed={followed.has(producer.id)}
                      disabled={following.loading || !!following.error}
                    />
                  ))}
                </View>
              </Section>
            ) : null}
            <Text style={[s.mono, { paddingVertical: space[12] }]}>
              {mode === 'Releases'
                ? `${releaseResult.length} releases loaded`
                : mode === 'Tracks'
                  ? `${result.length.toLocaleString()} ${result.length === 1 ? 'track' : 'tracks'} loaded`
                  : `${entities.length} ${mode.toLowerCase()} loaded`}
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          'release' in item ? (
            <ReleaseCard release={item.release} />
          ) : 'track' in item ? (
            <TrackRow track={item.track} />
          ) : (
            <View style={[s.grid, { paddingBottom: space[10] }]}>
              {item.entities.map((entity) =>
                mode === 'Producers' ? (
                  <ProducerCard
                    key={entity.id}
                    producer={entity}
                    followed={followed.has(entity.id)}
                    disabled={following.loading || !!following.error}
                  />
                ) : (
                  <EntityCard key={entity.id} entity={entity} type="artist" />
                ),
              )}
            </View>
          )
        }
        ListFooterComponent={
          page.hasMore ? (
            <Button quiet busy={loading} onPress={page.loadMore}>
              {error ? 'Retry loading' : 'Load more'}
            </Button>
          ) : null
        }
        ListEmptyComponent={
          <Empty
            title={
              loading
                ? 'Loading catalog…'
                : error
                  ? 'Could not load the catalog.'
                  : page.hasMore && text
                    ? 'More results to check.'
                    : 'Nothing here yet.'
            }
            detail={
              loading
                ? undefined
                : error
                  ? 'Retry below.'
                  : page.hasMore && text
                    ? 'Continue searching the catalog below.'
                    : 'Try another name or scene.'
            }
          />
        }
      />
    </Page>
  );
}
