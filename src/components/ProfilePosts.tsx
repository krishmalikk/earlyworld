import { radius, space } from '../../shared/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePostPage } from '../data/social';
import { PostCard } from './PostCard';
import { Button, c, ErrorLine, s, Section } from './ui';

export function ProfilePosts({ uid, own }: { uid: string; own: boolean }) {
  const posts = usePostPage({ mode: 'profile', uid });
  const submissions = usePostPage({ mode: 'submissions' }, own);
  return (
    <Section title="Posts">
      <ErrorLine message={posts.error || submissions.error} />
      {posts.error || submissions.error ? (
        <Button
          quiet
          onPress={() => {
            posts.refresh();
            submissions.refresh();
          }}
        >
          Retry posts
        </Button>
      ) : null}
      {own
        ? submissions.data.map((post) => (
            <Pressable
              key={post.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/post/[id]', params: { id: post.id, own: 'true' } })
              }
              style={s.panel}
            >
              <Text style={s.text}>
                {post.status === 'processing'
                  ? 'Processing photos'
                  : post.status === 'pending'
                    ? 'Publishing'
                    : 'Couldn’t publish'}
              </Text>
              <Text style={s.muted} numberOfLines={2}>
                {post.reason ||
                  post.text ||
                  post.attachment?.label ||
                  `${post.mediaIds.length} photos`}
              </Text>
              <Text style={s.link}>{post.reason ? 'View & fix post' : 'View status'}</Text>
            </Pressable>
          ))
        : null}
      {own && submissions.more ? (
        <Button quiet busy={submissions.loading} onPress={submissions.loadMore}>
          More submissions
        </Button>
      ) : null}
      {posts.data.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {!posts.loading &&
      !posts.data.length &&
      !submissions.data.length &&
      !submissions.loading &&
      !posts.error ? (
        <View style={[s.panel, { gap: space[12], alignItems: 'stretch' }]}>
          {own ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a post"
              onPress={() => router.push('/(tabs)/create')}
              style={({ pressed }) => [styles.plus, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="add" size={28} color={c.accent} />
            </Pressable>
          ) : null}
          <Text style={[s.muted, own && { textAlign: 'center' }]}>
            {own ? 'You have no posts' : 'No posts yet.'}
          </Text>
          {own ? (
            <Button onPress={() => router.push('/(tabs)/create')}>Create a post</Button>
          ) : null}
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
