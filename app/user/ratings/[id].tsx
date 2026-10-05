import { space } from '../../../shared/theme';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useRatingList } from '../../../src/data/ratings';
import { RatingCard } from '../../../src/components/Ratings';
import { Button, c, ErrorLine, Heading, Page, s } from '../../../src/components/ui';
export default function RatingHistory() {
  const { id, sort } = useLocalSearchParams<{ id: string; sort?: string }>();
  return <History key={`${id}:${sort}`} uid={id} highest={sort === 'highest'} />;
}
function History({ uid, highest }: { uid: string; highest: boolean }) {
  const [count, setCount] = useState(25);
  const list = useRatingList({ uid, highest, count });
  return (
    <Page scroll={false}>
      <FlatList
        data={list.data}
        keyExtractor={(rating) => rating.id}
        contentContainerStyle={s.body}
        ListHeaderComponent={
          <View style={{ gap: space[12] }}>
            <Heading title={highest ? 'Highest rated' : 'Ratings & reviews'} />
            <ErrorLine message={list.error} />
            {list.loading ? <ActivityIndicator color={c.accent} /> : null}
          </View>
        }
        renderItem={({ item }) => <RatingCard rating={item} />}
        ListEmptyComponent={
          !list.loading && !list.error ? (
            <Text style={s.muted}>
              {highest ? 'No tracks rated four stars or higher yet.' : 'No ratings yet.'}
            </Text>
          ) : null
        }
        ListFooterComponent={
          list.data.length >= count ? (
            <Button quiet onPress={() => setCount((n) => n + 25)}>
              Load more ratings
            </Button>
          ) : null
        }
      />
    </Page>
  );
}
