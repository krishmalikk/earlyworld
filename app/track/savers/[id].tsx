import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { doc } from '@react-native-firebase/firestore';
import { db } from '../../../src/lib/firebase';
import { useDocument } from '../../../src/data/listeners';
import type { Track } from '../../../src/data/types';
import { UserLine } from '../../../src/components/UserLine';
import { Button, Empty, ErrorLine, Page, s } from '../../../src/components/ui';
import { space } from '../../../shared/theme';

const PAGE = 25;
/** Everyone the track document still lists as an early saver, in save order. */
export default function Savers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ref = useMemo(() => doc(db, 'tracks', id), [id]);
  const track = useDocument<Track>(ref);
  const [shown, setShown] = useState(PAGE);
  const savers = track.data?.savers || [];
  return (
    <Page scroll={false}>
      <Stack.Screen options={{ title: 'Saved by' }} />
      <FlatList
        data={savers.slice(0, shown)}
        keyExtractor={(uid) => uid}
        contentContainerStyle={s.body}
        ListHeaderComponent={
          <View style={{ gap: space[8] }}>
            <ErrorLine message={track.error} />
            {track.data ? (
              <Text style={s.muted}>
                {track.data.title} · {track.data.saveCount}{' '}
                {track.data.saveCount === 1 ? 'save' : 'saves'}
                {track.data.saversCapped ? ' · showing the first 200 listeners' : ''}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <UserLine uid={item} />}
        ListEmptyComponent={track.loading ? null : <Empty title="No saves yet." />}
        ListFooterComponent={
          savers.length > shown ? (
            <Button quiet onPress={() => setShown((n) => n + PAGE)}>
              Show more
            </Button>
          ) : null
        }
      />
    </Page>
  );
}
