import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useCatalog } from '../../src/data/catalog';
import { SCENES } from '../../shared/domain';
import { Chip, Empty, ErrorLine, Field, Heading, Page, s, Section } from '../../src/components/ui';
import { TrackRow } from '../../src/components/TrackRow';
import { EntityCard } from '../../src/components/EntityCard';
export default function Discover() {
  const { tracks, artists, producers, error } = useCatalog();
  const [search, setSearch] = useState(''),
    [scene, setScene] = useState(''),
    [mode, setMode] = useState('Tracks');
  const text = search.toLowerCase().trim();
  const selectedArtists = artists.filter(
    (a) =>
      (!scene || a.scenes?.includes(scene)) &&
      (!text || [a.name, ...a.aliases, ...(a.scenes || [])].join(' ').toLowerCase().includes(text)),
  );
  const sceneArtists = new Set(
    artists.filter((a) => !scene || a.scenes?.includes(scene)).map((a) => a.id),
  );
  const result = tracks
    .filter(
      (t) =>
        sceneArtists.has(t.artistId) &&
        [
          t.title,
          t.artistName,
          t.producerName,
          ...(artists.find((a) => a.id === t.artistId)?.scenes || []),
        ]
          .join(' ')
          .toLowerCase()
          .includes(text),
    )
    .sort((a, b) => a.saveCount - b.saveCount);
  const producerResults = producers.filter(
    (p) =>
      [p.name, ...p.aliases].join(' ').toLowerCase().includes(text) &&
      (!scene || tracks.some((t) => t.producerId === p.id && sceneArtists.has(t.artistId))),
  );
  return (
    <Page>
      <Heading eyebrow="THE CATALOG / OPEN TO EVERYONE" title="Go a little deeper." />
      <Field
        accessibilityLabel="Search catalog"
        placeholder="Track, artist, producer, scene"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
      />
      <View style={s.grid}>
        {['Tracks', 'Artists', 'Producers'].map((label) => (
          <Chip
            key={label}
            label={label}
            selected={mode === label}
            onPress={() => setMode(label)}
          />
        ))}
      </View>
      <View style={s.grid}>
        <Chip label="All scenes" selected={!scene} onPress={() => setScene('')} />
        {SCENES.map((label) => (
          <Chip
            key={label}
            label={label}
            selected={scene === label}
            onPress={() => setScene(label)}
          />
        ))}
      </View>
      <ErrorLine message={error} />
      <Section title={mode === 'Tracks' ? `${result.length} TRACKS / FEWER SAVES FIRST` : mode}>
        {mode === 'Tracks' ? (
          <View>
            {result.map((track, i) => (
              <TrackRow key={track.id} track={track} index={i} />
            ))}
            {!result.length ? (
              <Empty title="Nothing here yet." detail="Try another name or scene." />
            ) : null}
          </View>
        ) : (
          <View style={s.grid}>
            {(mode === 'Artists' ? selectedArtists : producerResults).map((entity) => (
              <EntityCard
                key={entity.id}
                entity={entity}
                type={mode === 'Artists' ? 'artist' : 'producer'}
              />
            ))}
            {!(mode === 'Artists' ? selectedArtists : producerResults).length ? (
              <Text style={s.muted}>No matches. Try a different search.</Text>
            ) : null}
          </View>
        )}
      </Section>
    </Page>
  );
}
