import { useCallback, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { fontWeight, radius, space } from '../shared/theme';
import { useActivity } from '../src/data/activity';
import { useProfile } from '../src/data/profiles';
import { call, report } from '../src/lib/firebase';
import type { ActivityNotice } from '../src/data/types';
import { Artwork, c, Empty, ErrorLine, Page, s } from '../src/components/ui';

const copy = {
  follow: 'followed you',
  like: 'liked your post',
  comment: 'commented on your post',
  match: 'matched with you',
  published: 'Your post is live.',
};
function open(notice: ActivityNotice) {
  if (notice.postId) router.push({ pathname: '/post/[id]', params: { id: notice.postId } });
  else if (notice.type === 'match') router.push('/(tabs)/matches');
  else router.push(`/user/${notice.actorUid}`);
}
function Row({ notice, unread }: { notice: ActivityNotice; unread: boolean }) {
  const actor = useProfile(notice.actorUid);
  // Blocked and removed accounts come back null, so their notices disappear.
  if (actor === null) return null;
  const name = actor?.username ? `@${actor.username}` : 'A listener';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'New: ' : ''}${notice.type === 'published' ? copy.published : `${name} ${copy[notice.type]}`}`}
      onPress={() => open(notice)}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.avatar}>
        <Artwork uri={actor?.avatarUrl} name={actor?.username || 'ew'} size={44} />
      </View>
      <View style={{ flex: 1, gap: space[2] }}>
        <Text style={s.text}>
          {notice.type === 'published' ? (
            copy.published
          ) : (
            <>
              <Text style={{ fontWeight: fontWeight.bold }}>{name}</Text> {copy[notice.type]}
            </>
          )}
        </Text>
        <Text style={s.muted}>{notice.createdAt?.toDate().toLocaleDateString()}</Text>
      </View>
      {unread ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}
export default function Activity() {
  const activity = useActivity();
  const unread = useRef(0);
  unread.current = activity.unread;
  // Marking on leave keeps new rows highlighted while the screen is open.
  useFocusEffect(
    useCallback(
      () => () => {
        if (unread.current) void call('markActivitySeen').catch(report);
      },
      [],
    ),
  );
  return (
    <Page scroll={false}>
      <FlatList
        data={activity.data}
        keyExtractor={(notice) => notice.id}
        contentContainerStyle={[s.body, { gap: space[0] }]}
        ListHeaderComponent={<ErrorLine message={activity.error} />}
        renderItem={({ item }) => (
          <Row notice={item} unread={(item.createdAt?.toMillis() || 0) > activity.seenAt} />
        )}
        ListEmptyComponent={
          activity.loading ? (
            <ActivityIndicator color={c.accent} accessibilityLabel="Loading activity" />
          ) : activity.error ? null : (
            <Empty
              title="Nothing here yet."
              detail="New followers, likes, comments and matches show up here."
            />
          )
        }
      />
    </Page>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingVertical: space[12],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.line,
  },
  avatar: { borderRadius: radius.pill, overflow: 'hidden' },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: c.accent },
});
