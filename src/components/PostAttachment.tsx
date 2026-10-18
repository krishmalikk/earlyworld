import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { CatalogAttachment } from '../../shared/social';
import { space } from '../../shared/theme';
import { useCatalogIds } from '../data/catalog';
import { Artwork, c, s } from './ui';

const collections = {
  track: 'tracks',
  release: 'releases',
  artist: 'artists',
  producer: 'producers',
} as const;
export function openAttachment(a: CatalogAttachment) {
  if (a.kind === 'track') router.push(`/track/${a.id}`);
  else if (a.kind === 'release') router.push(`/release/${a.id}`);
  else router.push({ pathname: '/entity/[id]', params: { id: a.id, type: a.kind } });
}
/** References join the existing pooled catalog subscriptions, including attachment-only posts. */
export function PostAttachment({ attachment }: { attachment: CatalogAttachment }) {
  const catalog = useCatalogIds(collections[attachment.kind], [attachment.id]);
  const item = catalog.byId.get(attachment.id);
  const title = item
    ? 'title' in item
      ? item.title
      : item.name
    : attachment.label || 'Linked music';
  const uri = item
    ? 'artworkUrl' in item
      ? item.artworkUrl
      : 'imageUrl' in item
        ? item.imageUrl
        : undefined
    : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${attachment.kind}: ${title}`}
      accessibilityState={{ disabled: !item }}
      disabled={!item}
      onPress={() => openAttachment(attachment)}
      style={[s.panel, s.row, { backgroundColor: c.bg }]}
    >
      <Artwork uri={uri} name={title} size={56} />
      <View style={{ flex: 1, gap: space[4] }}>
        <Text style={s.text} numberOfLines={2}>
          {title}
        </Text>
        <Text style={s.muted} numberOfLines={2}>
          {item
            ? `${attachment.kind.charAt(0).toUpperCase() + attachment.kind.slice(1)}${'artistName' in item ? ` · ${item.artistName}` : ''}`
            : catalog.error
              ? 'Could not load linked music. Try reopening this post.'
              : catalog.loading
                ? 'Loading linked music…'
                : 'This catalog item is unavailable.'}
        </Text>
      </View>
      {item ? <Ionicons name="chevron-forward" size={18} color={c.accent} /> : null}
    </Pressable>
  );
}
