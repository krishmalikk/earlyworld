import { useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useLocal } from '../../../src/state/local';
import { useSavedLibrary } from '../../../src/data/saved-library';
import { useCatalogIds } from '../../../src/data/catalog';
import { TrackRow } from '../../../src/components/TrackRow';
import { Artwork, Button, c, ErrorLine, Field, Heading, Page, s } from '../../../src/components/ui';
import { space } from '../../../shared/theme';

export default function SavedTracks() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useLocal((state) => state.uid);
  return <Library key={`${uid}:${id}`} author={id} />;
}
function Library({ author }: { author: string }) {
  const [search, setSearch] = useState('');
  const list = useSavedLibrary(author, search);
  const catalog = useCatalogIds(
    'tracks',
    list.data.map((save) => save.trackId),
  );
  return (
    <Page scroll={false}>
      <View style={{ padding: space[18], gap: space[12] }}>
        <Heading title="Saved tracks" />
        <Field
          value={search}
          onChangeText={setSearch}
          maxLength={100}
          placeholder="Search saved tracks, artists, producers"
          accessibilityLabel="Search saved library"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
      <FlatList
        data={list.data}
        keyExtractor={(save) => save.id}
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
        refreshing={list.loading && !!list.data.length}
        onRefresh={list.refresh}
        renderItem={({ item }) => {
          const track = catalog.byId.get(item.trackId);
          return track ? (
            <TrackRow track={track} variant="card" />
          ) : (
            <View style={[s.panel, s.row]}>
              <Artwork uri={item.artworkUrl} name={item.title} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={s.text}>{item.title}</Text>
                <Text style={s.muted}>{item.artistName}</Text>
                <Text style={s.muted}>
                  {catalog.loading
                    ? 'Loading track…'
                    : catalog.error
                      ? 'Could not load track details.'
                      : 'Track no longer available.'}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !list.loading && !list.error ? (
            <Text style={s.muted}>
              {search.trim() ? 'No saved tracks match this search.' : 'No saved tracks yet.'}
            </Text>
          ) : null
        }
        ListFooterComponent={
          <View style={{ gap: space[12] }}>
            <ErrorLine message={list.error || catalog.error} />
            {list.loading ? (
              <ActivityIndicator color={c.accent} accessibilityLabel="Loading saved tracks" />
            ) : null}
            {list.error ? (
              <Button quiet onPress={list.loadMore}>
                Retry
              </Button>
            ) : list.more ? (
              <Button quiet busy={list.loading} onPress={list.loadMore}>
                Load more saved tracks
              </Button>
            ) : null}
          </View>
        }
      />
    </Page>
  );
}
