import { useMemo } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { doc } from '@react-native-firebase/firestore';
import { useDocument } from '../../src/data/listeners';
import { useCatalogIds } from '../../src/data/catalog';
import { db } from '../../src/lib/firebase';
import type { Release } from '../../src/data/types';
import { Artwork, Button, Empty, ErrorLine, Page, s, Section } from '../../src/components/ui';
import { RatingEditor } from '../../src/components/Ratings';
import { ReleaseReviews, releaseLabels } from '../../src/components/Releases';
import { TrackRow } from '../../src/components/TrackRow';
import { space, radius } from '../../shared/theme';
export default function ReleasePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ref = useMemo(() => doc(db, 'releases', id), [id]);
  const state = useDocument<Release>(ref);
  const catalog = useCatalogIds('tracks', state.data?.tracks.map((t) => t.trackId) || []);
  const release = state.data;
  return (
    <Page>
      <Stack.Screen options={{ title: 'Release' }} />
      <ErrorLine message={state.error} />
      {!release ? (
        <Empty title={state.loading ? 'Loading release…' : 'Release unavailable'} />
      ) : (
        <>
          <View style={{ alignItems: 'center', gap: space[12] }}>
            <View
              style={{ width: '85%', maxWidth: 360, borderRadius: radius.card, overflow: 'hidden' }}
            >
              <Artwork uri={release.artworkUrl} name={release.title} size="fill" />
            </View>
            <Text style={[s.title, s.displayTitle, { textAlign: 'center' }]}>{release.title}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/entity/[id]',
                  params: { id: release.artistId, type: 'artist' },
                })
              }
            >
              <Text style={s.link}>{release.artistName} ↗</Text>
            </Pressable>
            <Text style={s.muted}>
              {releaseLabels[release.releaseType]}
              {release.releasedAt ? ` · ${release.releasedAt}` : ''} · {release.tracks.length}{' '}
              tracks
            </Text>
            <Button quiet onPress={() => Linking.openURL(release.sourceUrl)}>
              SoundCloud ↗
            </Button>
          </View>
          <RatingEditor key={release.id} track={release} kind="release" />
          <Section title="Tracklist">
            {release.tracks.map((entry, index) => {
              const track = entry.trackId ? catalog.byId.get(entry.trackId) : undefined;
              return (
                <View key={`${entry.urn}:${index}`} style={[s.row, { alignItems: 'center' }]}>
                  <Text style={s.muted}>{String(index + 1).padStart(2, '0')}</Text>
                  <View style={{ flex: 1 }}>
                    {track ? (
                      <TrackRow track={track} />
                    ) : (
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={`${entry.title}, open on SoundCloud`}
                        onPress={() => Linking.openURL(entry.sourceUrl)}
                        style={s.panel}
                      >
                        <Text style={s.text}>{entry.title}</Text>
                        <Text style={s.muted}>{entry.artistName}</Text>
                        <Text style={s.link}>SoundCloud ↗</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </Section>
          <ReleaseReviews key={release.id} releaseId={release.id} />
        </>
      )}
    </Page>
  );
}
