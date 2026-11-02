import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { collection } from '@react-native-firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useCommunity } from '../../../src/data/community';
import { useCollection } from '../../../src/data/listeners';
import { useLocal } from '../../../src/state/local';
import { db } from '../../../src/lib/firebase';
import type { Follow } from '../../../src/data/types';
import { UserLine } from '../../../src/components/UserLine';
import { FollowButton } from '../../../src/components/FollowButton';
import { Artwork, Button, c, ErrorLine, Page, s, Segmented } from '../../../src/components/ui';
import { radius, space } from '../../../shared/theme';

const SEGMENTS = [
  { value: 'user', label: 'Listeners' },
  { value: 'artist', label: 'Artists' },
  { value: 'producer', label: 'Producers' },
] as const;
type TargetType = (typeof SEGMENTS)[number]['value'];
type Row = { id: string; name?: string; imageUrl?: string };

export default function FollowList() {
  const { id, list } = useLocalSearchParams<{ id: string; list?: string }>();
  const uid = useLocal((state) => state.uid);
  const kind = list === 'following' ? 'following' : 'followers';
  return <Listeners key={`${uid}:${id}:${kind}`} viewer={uid} author={id} kind={kind} />;
}
function Listeners({
  viewer,
  author,
  kind,
}: {
  viewer: string | null;
  author: string;
  kind: 'followers' | 'following';
}) {
  const [count, setCount] = useState(25),
    [targetType, setTargetType] = useState<TargetType>('user');
  const list = useCommunity<Row>({ kind, uid: author, targetType }, count);
  const followRef = useMemo(
    () => (viewer ? collection(db, 'users', viewer, 'following') : null),
    [viewer],
  );
  const follows = useCollection<Follow>(followRef);
  const followed = useMemo(() => new Set(follows.data.map((f) => f.id)), [follows.data]);
  const empty =
    kind === 'followers'
      ? 'No followers yet.'
      : targetType === 'user'
        ? 'Not following any listeners yet.'
        : `Not following any ${targetType}s yet.`;
  return (
    <Page scroll={false}>
      <Stack.Screen options={{ title: kind === 'following' ? 'Following' : 'Followers' }} />
      <FlatList
        data={list.data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.body}
        ListHeaderComponent={
          <View style={{ gap: space[12] }}>
            {kind === 'following' ? (
              <Segmented
                subtle
                options={SEGMENTS}
                value={targetType}
                onChange={(value) => {
                  setTargetType(value);
                  setCount(25);
                }}
              />
            ) : null}
            <ErrorLine message={list.error || follows.error} />
          </View>
        }
        renderItem={({ item }) =>
          targetType === 'user' ? (
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <UserLine uid={item.id} />
              </View>
              <FollowButton
                uid={item.id}
                following={followed.has(item.id)}
                disabled={follows.loading || !!follows.error}
              />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/entity/[id]', params: { id: item.id, type: targetType } })
              }
              style={[s.row, { paddingVertical: space[8] }]}
            >
              <View style={{ borderRadius: radius.pill, overflow: 'hidden' }}>
                <Artwork uri={item.imageUrl} name={item.name || 'ew'} size={40} />
              </View>
              <Text style={[s.text, { flex: 1 }]}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </Pressable>
          )
        }
        ListEmptyComponent={
          list.loading ? (
            <ActivityIndicator color={c.accent} accessibilityLabel="Loading" />
          ) : !list.error ? (
            <Text style={s.muted}>{empty}</Text>
          ) : null
        }
        ListFooterComponent={
          list.more ? (
            <View style={{ paddingTop: space[12] }}>
              <Button quiet busy={list.loading} onPress={() => setCount((n) => n + 25)}>
                Load more
              </Button>
            </View>
          ) : null
        }
      />
    </Page>
  );
}
