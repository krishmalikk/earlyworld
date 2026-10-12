import { fontSize, fontWeight, lineHeight, radius, space } from '../../shared/theme';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCatalogIds, useCatalogPage } from '../data/catalog';
import { ratingMutation } from '../data/ratings';
import { useSaves } from '../data/saves';
import { errorMessage } from '../lib/firebase';
import type { Release, Track } from '../data/types';
import { Button, c, ErrorLine, Field, s, Section } from './ui';
import { Artwork } from './Artwork';
import { TrackRow } from './TrackRow';
import { ReleaseCard } from './Releases';

const SLOTS = 4;
type Kind = 'track' | 'release';

export function FavoriteTracks({
  ids,
  own,
  kind = 'track',
}: {
  ids: string[];
  own: boolean;
  kind?: Kind;
}) {
  const label = kind === 'release' ? 'releases' : 'tracks';
  // null = closed; otherwise the slot the picker starts on.
  const [opening, setOpening] = useState<number | null>(null);
  const byId = useCatalogIds(kind === 'release' ? 'releases' : 'tracks', ids).byId;
  const edit = (slot = Math.min(ids.length, SLOTS - 1)) => setOpening(slot);
  return (
    <Section
      title={`Favorite ${label}`}
      right={
        own ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {kind === 'track' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share your orbit card"
                onPress={() => router.push({ pathname: '/share', params: { card: 'orbit' } })}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[12] }}
              >
                <Ionicons name="share-outline" size={20} color={c.accent} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit favorite ${label}`}
              onPress={() => edit()}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[12] }}
            >
              <Text style={s.link}>Edit ↗</Text>
            </Pressable>
          </View>
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
              onPress={() =>
                track ? router.push(`/${kind}/${track.id}`) : edit(Math.min(index, ids.length))
              }
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
              {ids[index] ? (
                <Text
                  numberOfLines={2}
                  style={[
                    s.text,
                    { fontSize: fontSize.smallLabel, lineHeight: lineHeight.caption },
                  ]}
                >
                  {track?.title || 'Unavailable'}
                </Text>
              ) : null}
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
      {opening !== null ? (
        <FavoritePicker
          kind={kind}
          ids={ids}
          startSlot={opening}
          onClose={() => setOpening(null)}
        />
      ) : null}
    </Section>
  );
}

function FavoritePicker({
  kind,
  ids,
  startSlot,
  onClose,
}: {
  kind: Kind;
  ids: string[];
  startSlot: number;
  onClose: () => void;
}) {
  const label = kind === 'release' ? 'releases' : 'tracks';
  const [draft, setDraft] = useState<string[]>(ids),
    // The slot the next pick goes into; null when all four are full and none is chosen.
    [active, setActive] = useState<number | null>(startSlot),
    [text, setText] = useState(''),
    [search, setSearch] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const saves = useSaves();
  const suggested = kind === 'track' && !search ? [...saves.ids].slice(0, 12) : [];
  const catalog = useCatalogIds(kind === 'release' ? 'releases' : 'tracks', [
    ...draft,
    ...suggested,
  ]);
  const page = useCatalogPage(kind === 'release' ? 'releases' : 'tracks', { text: search });
  const browse = page.data.filter((item) => !suggested.includes(item.id));
  const changed = draft.join() !== ids.join();

  function pick(id: string) {
    setError(null);
    const at = draft.indexOf(id);
    if (at >= 0) return remove(at);
    if (active === null) {
      setError(`You have four favorites. Tap one above to replace it.`);
      return;
    }
    const next = [...draft];
    next[Math.min(active, next.length)] = id;
    setDraft(next);
    setActive(next.length < SLOTS ? next.length : null);
  }
  function remove(index: number) {
    const next = draft.filter((_, i) => i !== index);
    setDraft(next);
    setActive(next.length);
  }
  function move(index: number, direction: -1 | 1) {
    const next = [...draft];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setDraft(next);
    setActive(index + direction);
  }
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await ratingMutation(
        kind === 'release' ? 'setFavoriteReleases' : 'setFavoriteTracks',
        kind === 'release' ? { releaseIds: draft } : { trackIds: draft },
      );
      onClose();
    } catch (e) {
      setError(`Could not save favorites. ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }
  const option = (item: Track | Release) => {
    const selected = draft.includes(item.id);
    return kind === 'release' ? (
      <ReleaseCard
        key={item.id}
        release={item as Release}
        selected={selected}
        onSelect={() => pick(item.id)}
      />
    ) : (
      <TrackRow
        key={item.id}
        track={item as Track}
        variant="card"
        showOwnRating={false}
        selected={selected}
        onSelect={() => pick(item.id)}
      />
    );
  };
  const filled = active !== null && active < draft.length;
  return (
    <Modal
      visible
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={s.page} edges={['top', 'bottom']}>
        <View style={sheet.header}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onClose}
            style={sheet.headerButton}
          >
            <Text style={s.muted}>Cancel</Text>
          </Pressable>
          <Text accessibilityRole="header" style={sheet.headerTitle}>
            Favorite {label}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !changed || busy, busy }}
            disabled={!changed || busy}
            onPress={save}
            style={[sheet.headerButton, { alignItems: 'flex-end' }]}
          >
            <Text
              style={[s.link, { fontWeight: fontWeight.bold, opacity: changed && !busy ? 1 : 0.4 }]}
            >
              {busy ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>
        <View style={sheet.slots}>
          <View style={{ flexDirection: 'row', gap: space[8] }}>
            {Array.from({ length: SLOTS }, (_, index) => {
              const item = catalog.byId.get(draft[index]);
              const isActive =
                active === index ||
                (active !== null && index === draft.length && active > draft.length);
              return (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={
                    draft[index]
                      ? `Favorite ${index + 1}: ${item?.title || 'loading'}. Tap to replace or move.`
                      : `Empty favorite slot ${index + 1}`
                  }
                  disabled={index > draft.length}
                  onPress={() => {
                    setError(null);
                    setActive(
                      active === index && draft[index]
                        ? draft.length < SLOTS
                          ? draft.length
                          : null
                        : index,
                    );
                  }}
                  style={{ flex: 1, gap: space[6] }}
                >
                  <View
                    style={[
                      sheet.tile,
                      draft[index] ? null : sheet.emptyTile,
                      isActive && sheet.activeTile,
                    ]}
                  >
                    {item ? (
                      <Artwork uri={item.artworkUrl} name={item.title} size="fill" />
                    ) : (
                      <Text style={[s.mono, { color: isActive ? c.accent : c.muted }]}>
                        {index + 1}
                      </Text>
                    )}
                    {draft[index] ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${item?.title || 'favorite'}`}
                        hitSlop={8}
                        onPress={() => remove(index)}
                        style={sheet.removeBadge}
                      >
                        <Ionicons name="close" size={14} color={c.text} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[s.muted, { fontSize: fontSize.smallCaption, textAlign: 'center' }]}
                  >
                    {item?.title || (isActive ? 'Next' : ' ')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={sheet.hintRow}>
            <Text style={[s.muted, { flex: 1, fontSize: fontSize.caption }]}>
              {filled
                ? `Pick a ${kind} below to replace slot ${active + 1}, or move it.`
                : active === null
                  ? 'All four chosen. Tap one to replace it.'
                  : `Pick a ${kind} for slot ${active + 1}.`}
            </Text>
            {filled ? (
              <View style={{ flexDirection: 'row' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Move left"
                  disabled={active === 0}
                  onPress={() => move(active, -1)}
                  style={[sheet.moveButton, { opacity: active === 0 ? 0.3 : 1 }]}
                >
                  <Ionicons name="chevron-back" size={18} color={c.text} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Move right"
                  disabled={active >= draft.length - 1}
                  onPress={() => move(active, 1)}
                  style={[sheet.moveButton, { opacity: active >= draft.length - 1 ? 0.3 : 1 }]}
                >
                  <Ionicons name="chevron-forward" size={18} color={c.text} />
                </Pressable>
              </View>
            ) : null}
          </View>
          <View style={sheet.search}>
            <Ionicons name="search" size={18} color={c.muted} />
            <Field
              accessibilityLabel={`Search ${label}`}
              placeholder={
                kind === 'release'
                  ? 'Search releases or artists'
                  : 'Search songs, artists or producers'
              }
              value={text}
              onChangeText={setText}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              style={sheet.searchField}
            />
          </View>
          <ErrorLine message={error} />
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={sheet.results}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {suggested.length ? (
              <>
                <Text style={[s.mono, sheet.group]}>FROM YOUR SAVES</Text>
                {suggested.flatMap((id) => {
                  const item = catalog.byId.get(id);
                  return item ? [option(item)] : [];
                })}
                <Text style={[s.mono, sheet.group]}>MORE TRACKS</Text>
              </>
            ) : search ? (
              <Text style={[s.mono, sheet.group]}>RESULTS</Text>
            ) : null}
            {browse.map(option)}
            <ErrorLine message={page.error || catalog.error} />
            {!browse.length && !page.loading ? (
              <Text style={[s.muted, { textAlign: 'center', paddingVertical: space[20] }]}>
                {search ? `No ${label} match “${search}”.` : `No ${label} to show yet.`}
              </Text>
            ) : null}
            {page.hasMore || page.loading ? (
              <Button quiet busy={page.loading} onPress={page.loadMore}>
                More results
              </Button>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[16],
    paddingVertical: space[8],
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  headerButton: { flex: 1, minHeight: 44, justifyContent: 'center' },
  headerTitle: {
    flex: 2,
    textAlign: 'center',
    color: c.text,
    fontSize: fontSize.label,
    fontWeight: fontWeight.bold,
  },
  slots: { padding: space[16], gap: space[12], borderBottomWidth: 1, borderBottomColor: c.line },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.large,
    overflow: 'hidden',
    backgroundColor: c.artworkBg,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTile: { borderStyle: 'dashed', borderColor: c.line },
  activeTile: { borderStyle: 'solid', borderColor: c.accent },
  removeBadge: {
    position: 'absolute',
    top: space[4],
    right: space[4],
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: c.bg,
    opacity: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', minHeight: 36, gap: space[8] },
  moveButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: c.panel,
    marginLeft: space[6],
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    paddingHorizontal: space[12],
    borderRadius: radius.pill,
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.line,
  },
  searchField: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: space[0],
  },
  results: { padding: space[16], gap: space[10], paddingBottom: space[40] },
  group: { marginTop: space[6] },
});
