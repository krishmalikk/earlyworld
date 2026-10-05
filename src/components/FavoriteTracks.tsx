import { fontSize, lineHeight, radius, space } from '../../shared/theme';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCatalogIds, useCatalogPage } from '../data/catalog';
import { ratingMutation } from '../data/ratings';
import { errorMessage } from '../lib/firebase';
import { Button, c, ErrorLine, Field, s, Section } from './ui';
import { Artwork } from './Artwork';

export function FavoriteTracks({
  ids,
  own,
  kind = 'track',
}: {
  ids: string[];
  own: boolean;
  kind?: 'track' | 'release';
}) {
  const label = kind === 'release' ? 'releases' : 'tracks';
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<string[]>([]),
    [selecting, setSelecting] = useState<number | null>(null),
    [search, setSearch] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const catalog = useCatalogIds(kind === 'release' ? 'releases' : 'tracks', [...ids, ...draft]);
  const byId = catalog.byId;
  const page = useCatalogPage(kind === 'release' ? 'releases' : 'tracks', {
    text: search,
    enabled: open && selecting !== null,
  });
  function edit() {
    setDraft([...ids]);
    setSelecting(null);
    setSearch('');
    setError(null);
    setOpen(true);
  }
  function choose(index: number) {
    setSelecting(index);
    setSearch('');
  }
  function move(index: number, direction: number) {
    setDraft((previous) => {
      const next = [...previous];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
  }
  const candidates = useMemo(
    () =>
      page.data.filter(
        (track) =>
          !draft.includes(track.id) || (selecting !== null && draft[selecting] === track.id),
      ),
    [page.data, draft, selecting],
  );
  return (
    <Section
      title={`Favorite ${label}`}
      right={
        own ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit favorite ${label}`}
            onPress={edit}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[12] }}
          >
            <Text style={s.link}>Edit ↗</Text>
          </Pressable>
        ) : undefined
      }
    >
      <View style={{ flexDirection: 'row', gap: space[8] }}>
        {Array.from({ length: 4 }, (_, index) => {
          const track = byId.get(ids[index]);
          return (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={
                track
                  ? `Favorite ${index + 1}: ${track.title} by ${track.artistName}`
                  : own
                    ? `Choose favorite ${label}, slot ${index + 1}`
                    : `Favorite slot ${index + 1}, empty`
              }
              disabled={!track && !own}
              onPress={() => (track ? router.push(`/${kind}/${track.id}`) : edit())}
              style={{ flex: 1, gap: space[6] }}
            >
              <View
                style={{
                  width: '100%',
                  borderRadius: radius.large,
                  overflow: 'hidden',
                  aspectRatio: 1,
                  backgroundColor: c.artworkBg,
                  borderWidth: 1,
                  borderColor: c.line,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {track ? (
                  <Artwork uri={track.artworkUrl} name={track.title} size="fill" />
                ) : (
                  <Text style={[s.mono, { color: c.accent }]}>{own ? '+' : '—'}</Text>
                )}
              </View>
              <Text
                numberOfLines={2}
                style={[s.text, { fontSize: fontSize.smallLabel, lineHeight: lineHeight.caption }]}
              >
                {track?.title || (ids[index] ? 'Unavailable' : '')}
              </Text>
              {track ? (
                <Text numberOfLines={1} style={[s.muted, { fontSize: fontSize.smallCaption }]}>
                  {track.artistName}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {!ids.length ? (
        <Text style={s.muted}>
          {own ? 'Choose up to four favorites.' : 'No favorites chosen yet.'}
        </Text>
      ) : null}
      <Modal
        visible={open}
        presentationStyle="pageSheet"
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <SafeAreaView style={s.page}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={[s.body, { gap: space[16] }]}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.title}>
                {selecting === null ? `Favorite ${label}` : `Choose a ${kind}`}
              </Text>
              {selecting === null ? (
                <>
                  <Text style={s.muted}>Choose up to four {label}.</Text>
                  {draft.map((id, index) => {
                    const track = byId.get(id);
                    return (
                      <View key={id} style={s.panel}>
                        <Text style={s.mono}>SLOT {index + 1}</Text>
                        <Text style={s.text}>{track?.title || 'Unavailable track'}</Text>
                        <Text style={s.muted}>{track?.artistName}</Text>
                        <View style={[s.row, { flexWrap: 'wrap' }]}>
                          {index > 0 ? (
                            <Button quiet disabled={busy} onPress={() => move(index, -1)}>
                              Move left
                            </Button>
                          ) : null}
                          {index < draft.length - 1 ? (
                            <Button quiet disabled={busy} onPress={() => move(index, 1)}>
                              Move right
                            </Button>
                          ) : null}
                          <Button quiet disabled={busy} onPress={() => choose(index)}>
                            Replace
                          </Button>
                          <Button
                            quiet
                            disabled={busy}
                            onPress={() =>
                              setDraft((previous) => previous.filter((_, i) => i !== index))
                            }
                          >
                            Remove
                          </Button>
                        </View>
                      </View>
                    );
                  })}
                  {draft.length < 4 ? (
                    <Button quiet disabled={busy} onPress={() => choose(draft.length)}>
                      Add a favorite
                    </Button>
                  ) : null}
                  <ErrorLine message={error || page.error || catalog.error} />
                  {selecting !== null && page.hasMore ? (
                    <Button quiet busy={page.loading} onPress={page.loadMore}>
                      More results
                    </Button>
                  ) : null}
                  <Button
                    busy={busy}
                    onPress={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        await ratingMutation(
                          kind === 'release' ? 'setFavoriteReleases' : 'setFavoriteTracks',
                          kind === 'release' ? { releaseIds: draft } : { trackIds: draft },
                        );
                        setOpen(false);
                      } catch (e) {
                        setError(`Could not save favorites. ${errorMessage(e)}`);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Save favorites
                  </Button>
                  <Button quiet disabled={busy} onPress={() => setOpen(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Field
                    accessibilityLabel={`Search ${label} for favorites`}
                    placeholder={kind === 'release' ? 'Release or artist' : 'Song or artist'}
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                  />
                  <ErrorLine message={catalog.error} />
                  {candidates.map((track) => (
                    <Pressable
                      key={track.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Choose ${track.title} by ${track.artistName}`}
                      onPress={() => {
                        setDraft((previous) => {
                          const next = [...previous];
                          next[selecting] = track.id;
                          return next;
                        });
                        setSelecting(null);
                      }}
                      style={[s.panel, { minHeight: 60 }]}
                    >
                      <Text style={s.text}>{track.title}</Text>
                      <Text style={s.muted}>{track.artistName}</Text>
                    </Pressable>
                  ))}
                  {!candidates.length ? (
                    <Text style={s.muted}>
                      {catalog.loading
                        ? 'Loading catalog…'
                        : `No ${label} found. Try another title or artist.`}
                    </Text>
                  ) : null}
                  <Button quiet onPress={() => setSelecting(null)}>
                    Back to favorites
                  </Button>
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </Section>
  );
}
