import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { doc } from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useLocal } from '../state/local';
import { useSaves } from '../data/saves';
import { db, errorMessage } from '../lib/firebase';
import { toggleSave } from '../data/actions';
import type { Save, Track } from '../data/types';
import { Artwork, c, ErrorLine, s } from './ui';
export function SaveButton({ track }: { track: Track }) {
  const uid = useLocal((x) => x.uid);
  const { ids, error: saveError } = useSaves();
  const data = ids.has(track.id);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function save() {
    if (!uid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await toggleSave(uid, track, !!data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <Pressable
        accessibilityLabel={data ? 'Unsave track' : 'Save track'}
        accessibilityRole="button"
        disabled={busy || !uid}
        onPress={save}
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: busy ? 0.4 : 1,
        }}
      >
        <Ionicons
          name={data ? 'bookmark' : 'bookmark-outline'}
          size={20}
          color={data ? c.accent : c.muted}
        />
      </Pressable>
      <ErrorLine message={error || saveError} />
    </View>
  );
}
export function TrackRow({
  track,
  index,
  context,
}: {
  track: Track;
  index?: number;
  context?: string;
}) {
  return (
    <View style={{ borderBottomWidth: 1, borderColor: c.line, paddingVertical: 12 }}>
      {context ? <Text style={[s.mono, { fontSize: 8, marginBottom: 8 }]}>{context}</Text> : null}
      <View style={s.row}>
        {index !== undefined ? (
          <Text style={[s.mono, { width: 20 }]}>{String(index + 1).padStart(2, '0')}</Text>
        ) : null}
        <Pressable onPress={() => router.push(`/track/${track.id}`)} style={[s.row, { flex: 1 }]}>
          <Artwork uri={track.artworkUrl} name={track.title} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={[s.text, { fontWeight: '600' }]}>
              {track.title}
            </Text>
            <Text numberOfLines={1} style={s.muted}>
              {track.artistName}
            </Text>
            {track.producerName ? (
              <Text numberOfLines={1} style={[s.link, { fontSize: 11 }]}>
                prod. {track.producerName}
              </Text>
            ) : null}
            <Text style={[s.mono, { fontSize: 8, letterSpacing: 0.7, marginTop: 3 }]}>
              {track.saveCount} saves · {track.sourcePlatform}
            </Text>
          </View>
        </Pressable>
        <SaveButton track={track} />
      </View>
    </View>
  );
}
