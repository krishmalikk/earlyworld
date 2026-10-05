import { useCommunity } from '../data/community';
import { radius, space } from '../../shared/theme';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { User } from '../data/types';
import { Artwork, s } from './ui';
export function UserLine({ uid, detail }: { uid: string; detail?: string }) {
  const profile = useCommunity<User>({ kind: 'profile', uid });
  const data = profile.data[0];
  if (profile.error) return null;
  return (
    <Pressable
      onPress={() => router.push(`/user/${uid}`)}
      style={[s.row, { paddingVertical: space[8] }]}
    >
      <View style={{ borderRadius: radius.pill, overflow: 'hidden' }}>
        <Artwork uri={data?.avatarUrl} name={data?.username || 'ew'} size={40} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.text}>@{data?.username || 'listener'}</Text>
        {detail ? <Text style={s.muted}>{detail}</Text> : null}
      </View>
      <Text style={s.muted}>↗</Text>
    </Pressable>
  );
}
