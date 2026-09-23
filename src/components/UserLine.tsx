import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { doc } from '@react-native-firebase/firestore';
import { db } from '../lib/firebase';
import { useDocument } from '../data/listeners';
import type { User } from '../data/types';
import { Artwork, s } from './ui';
export function UserLine({ uid, detail }: { uid: string; detail?: string }) {
  const ref = useMemo(() => doc(db, 'users', uid), [uid]);
  const { data } = useDocument<User>(ref);
  return (
    <Pressable onPress={() => router.push(`/user/${uid}`)} style={[s.row, { paddingVertical: 8 }]}>
      <Artwork uri={data?.avatarUrl} name={data?.username || 'ew'} size={32} />
      <View style={{ flex: 1 }}>
        <Text style={s.text}>@{data?.username || 'listener'}</Text>
        {detail ? <Text style={s.muted}>{detail}</Text> : null}
      </View>
      <Text style={s.muted}>↗</Text>
    </Pressable>
  );
}
