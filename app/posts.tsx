import { Stack, useLocalSearchParams } from 'expo-router';
import { PostList } from '../src/components/PostList';
export default function Posts() {
  const { mode, uid, kind } = useLocalSearchParams<{
    mode?: string;
    uid?: string;
    kind?: string;
  }>();
  return (
    <>
      <Stack.Screen
        options={{
          title:
            mode === 'own'
              ? 'Your submissions'
              : mode === 'bookmarks'
                ? 'Bookmarked posts'
                : 'Posts',
        }}
      />
      <PostList mode={mode} uid={uid} kind={kind} />
    </>
  );
}
