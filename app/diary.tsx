import { SectionList, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { space } from '../shared/theme';
import { useDiary } from '../src/data/diary';
import { DiaryMonthHeader, DiaryRow } from '../src/components/Diary';
import { Empty, ErrorLine, Page, s } from '../src/components/ui';

export default function Diary() {
  const diary = useDiary();
  return (
    <Page scroll={false}>
      <Stack.Screen options={{ title: 'Diary' }} />
      <SectionList
        sections={diary.months.map((month) => ({ ...month, data: month.entries }))}
        keyExtractor={(entry) => entry.key}
        contentContainerStyle={s.body}
        stickySectionHeadersEnabled={false}
        initialNumToRender={20}
        renderSectionHeader={({ section }) => <DiaryMonthHeader month={section} />}
        renderItem={({ item }) => <DiaryRow entry={item} />}
        ListHeaderComponent={<ErrorLine message={diary.error} />}
        ListEmptyComponent={
          diary.loading ? (
            <View />
          ) : (
            <Empty
              title="Your diary is empty."
              detail="Rate or save a track and it shows up here."
            />
          )
        }
        ListFooterComponent={
          diary.months.length ? (
            <Text style={[s.muted, { textAlign: 'center', paddingTop: space[24] }]}>
              That's everything since you joined.
            </Text>
          ) : null
        }
      />
    </Page>
  );
}
