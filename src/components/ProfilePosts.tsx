import { radius, space } from '../../shared/theme';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePostPage } from '../data/social';
import { PostCard } from './PostCard';
import { Button, c, ErrorLine, s, Section, Segmented } from './ui';

const TABS = [
  { kind: 'post', label: 'Posts', empty: 'posts', create: 'Create a post' },
  { kind: 'video', label: 'Videos', empty: 'videos', create: 'Create a video' },
] as const;

export function ProfilePosts({ uid, own }: { uid: string; own: boolean }) {
  const [kind, setKind] = useState<(typeof TABS)[number]['kind']>('post');
  const tab = TABS.find((t) => t.kind === kind)!;
  const posts = usePostPage({ mode: 'profile', uid, kind: tab.kind });
  return (
    <Section title="Posts & videos">
      <Segmented
        options={TABS.map((t) => ({ value: t.kind, label: t.label }))}
        value={kind}
        onChange={setKind}
      />
      <ErrorLine message={posts.error} />
      {posts.data.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {!posts.loading && !posts.data.length && !posts.error ? (
        <View style={[s.panel, { gap: space[12], alignItems: 'stretch' }]}>
          {own ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tab.create}
              onPress={() => router.push('/(tabs)/create')}
              style={({ pressed }) => [styles.plus, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="add" size={28} color={c.accent} />
            </Pressable>
          ) : null}
          <Text style={[s.muted, own && { textAlign: 'center' }]}>
            {own ? `You have no ${tab.empty}` : `No ${tab.empty} yet.`}
          </Text>
          {own ? <Button onPress={() => router.push('/(tabs)/create')}>{tab.create}</Button> : null}
        </View>
      ) : null}
      {posts.more ? (
        <Button quiet busy={posts.loading} onPress={posts.loadMore}>
          Load more
        </Button>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  plus: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
