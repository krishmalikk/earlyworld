import { useState } from 'react';
import { Image } from 'expo-image';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontSize, imageDefaults } from '../../shared/theme';
import { artworkSources } from '../../shared/artwork';

/** Shared covers and avatars, including an initials fallback for missing or failed URLs. */
export function Artwork({
  uri,
  name,
  size = 48,
}: {
  uri?: string | null;
  name: string;
  size?: number | 'fill';
}) {
  const [width, setWidth] = useState(0);
  const candidates = artworkSources(uri, (size === 'fill' ? width : size) * PixelRatio.get());
  const sourceKey = candidates.join('|');
  const [failure, setFailure] = useState({ key: '', index: 0 });
  const index = failure.key === sourceKey ? failure.index : 0;
  const imageUri = candidates[index];
  const dimensions = size === 'fill' ? styles.fill : { width: size, height: size };
  const showImage = !!imageUri && (size !== 'fill' || width > 0);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      onLayout={size === 'fill' ? (event) => setWidth(event.nativeEvent.layout.width) : undefined}
      style={[styles.frame, dimensions, !showImage && styles.fallback]}
    >
      {showImage ? (
        <Image
          key={imageUri}
          source={{ uri: imageUri }}
          {...imageDefaults}
          recyclingKey={imageUri}
          accessible={false}
          style={StyleSheet.absoluteFill}
          onError={() => setFailure({ key: sourceKey, index: index + 1 })}
        />
      ) : (
        <Text
          accessible={false}
          style={[styles.initials, { fontSize: size === 'fill' ? fontSize.label : size * 0.28 }]}
        >
          {name.trim().slice(0, 2).toUpperCase() || '—'}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.artworkBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: { width: '100%', aspectRatio: 1 },
  fallback: { borderWidth: 1, borderColor: colors.line },
  initials: { color: colors.accent, fontFamily: fontFamily.mono },
});
