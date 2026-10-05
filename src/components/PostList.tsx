import { FlatList } from 'react-native';
import { Button, Empty, ErrorLine, Page, s } from './ui';
import { usePostPage } from '../data/social';
import { PostCard } from './PostCard';
export function PostList({
  mode = 'explore',
  uid,
  kind,
}: {
  mode?: string;
  uid?: string;
  kind?: string;
}) {
  const posts = usePostPage({ mode, uid, kind });
  return (
    <Page scroll={false}>
      <FlatList
        data={posts.data}
        keyExtractor={(p) => p.id}
        contentContainerStyle={s.body}
        refreshing={posts.loading}
        onRefresh={posts.refresh}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={<ErrorLine message={posts.error} />}
        ListEmptyComponent={
          !posts.loading ? (
            <Empty
              title="No posts yet."
              detail={
                mode === 'own'
                  ? 'Your drafts and submitted posts appear here.'
                  : 'Approved posts will appear here.'
              }
            />
          ) : null
        }
        ListFooterComponent={
          posts.more ? (
            <Button quiet busy={posts.loading} onPress={posts.loadMore}>
              Load more
            </Button>
          ) : null
        }
      />
    </Page>
  );
}
