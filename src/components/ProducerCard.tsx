import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { fontSize, fontWeight, radius, space } from '../../shared/theme';
import type { Entity } from '../data/types';
import { useLocal } from '../state/local';
import { follow } from '../data/actions';
import { errorMessage } from '../lib/firebase';
import { Artwork, Button, c, ErrorLine, s } from './ui';
export function ProducerCard({
  producer,
  followed,
  disabled = false,
}: {
  producer: Entity;
  followed: boolean;
  disabled?: boolean;
}) {
  const uid = useLocal((state) => state.uid);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View producer ${producer.name}`}
        onPress={() =>
          router.push({ pathname: '/entity/[id]', params: { id: producer.id, type: 'producer' } })
        }
        style={{ gap: space[12], flex: 1 }}
      >
        <View style={s.between}>
          <View style={styles.avatar}>
            <Artwork uri={producer.imageUrl} name={producer.name} size={44} />
          </View>
          <Text style={styles.count}>{producer.trackCount} in catalog</Text>
        </View>
        <View style={{ gap: space[5] }}>
          <Text numberOfLines={2} style={styles.name}>
            {producer.name}
          </Text>
          <Text numberOfLines={2} style={s.muted}>
            {producer.biography || 'Production credits & releases'}
          </Text>
        </View>
        <View style={{ gap: space[5], alignItems: 'flex-start' }}>
          {(producer.scenes?.length
            ? producer.scenes.slice(0, 2)
            : [producer.geniusId ? 'Genius credits' : 'In earlyworld']
          ).map((tag) => (
            <Text key={tag} style={styles.tag}>
              {tag}
            </Text>
          ))}
        </View>
      </Pressable>
      <Button
        busy={busy}
        disabled={disabled || !uid}
        onPress={async () => {
          if (!uid || busy) return;
          setBusy(true);
          setError(null);
          try {
            await follow(uid, producer.id, 'producer', followed);
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {followed ? 'Following' : 'Follow'}
      </Button>
      <ErrorLine message={error} />
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    width: '48%',
    padding: space[12],
    gap: space[14],
    borderRadius: radius.large,
    backgroundColor: c.panel,
  },
  avatar: { borderRadius: radius.pill, overflow: 'hidden' },
  count: { fontSize: fontSize.smallCaption, color: c.muted, flexShrink: 1 },
  name: { color: c.text, fontSize: fontSize.trackTitle, fontWeight: fontWeight.bold },
  tag: {
    color: c.accent,
    fontSize: fontSize.smallCaption,
    backgroundColor: c.bg,
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    borderRadius: radius.small,
  },
});
