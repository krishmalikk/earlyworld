import { fontFamily, fontSize, fontWeight, radius, space, tracking } from '../../shared/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCatalogIds } from '../data/catalog';
import { useDiary } from '../data/diary';
import type { DiaryEntry, DiaryMonth } from '../../shared/diary';
import { Stars } from './RatingDisplay';
import { Artwork, c, ErrorLine, s, Section } from './ui';

const PREVIEW = 5;

export function DiaryMonthHeader({ month }: { month: DiaryMonth }) {
  const counts = [
    month.ratings ? `${month.ratings} ${month.ratings === 1 ? 'rating' : 'ratings'}` : null,
    month.saves ? `${month.saves} ${month.saves === 1 ? 'save' : 'saves'}` : null,
  ].filter(Boolean);
  return (
    <View accessibilityRole="header" style={styles.month}>
      <Text style={styles.monthLabel}>{month.label}</Text>
      <Text style={styles.monthCounts}>{counts.join(' · ')}</Text>
    </View>
  );
}

export function DiaryRow({ entry }: { entry: DiaryEntry }) {
  const release = entry.kind === 'release';
  // Saves carry their own title and cover; ratings look theirs up in the catalog.
  const needsLookup = !entry.title;
  const catalog = useCatalogIds(release ? 'releases' : 'tracks', needsLookup ? [entry.itemId] : []);
  const item = needsLookup ? catalog.byId.get(entry.itemId) : undefined;
  const title = entry.title || item?.title;
  const artist = entry.artistName || item?.artistName;
  const unavailable = needsLookup && !catalog.loading && !item;
  const date = new Date(entry.at);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}: ${
        unavailable ? 'Track unavailable' : `${title} by ${artist}`
      }, ${entry.saved ? 'saved' : `rated ${(entry.halfStars || 0) / 2} stars`}${entry.reviewed ? ', with a review' : ''}`}
      disabled={unavailable}
      onPress={() => router.push(release ? `/release/${entry.itemId}` : `/track/${entry.itemId}`)}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.day}>
        <Text style={styles.dayNumber}>{date.getDate()}</Text>
        <Text style={styles.dayName}>{date.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
      </View>
      <View style={styles.art}>
        <Artwork uri={entry.artworkUrl || item?.artworkUrl} name={title || '—'} size={48} />
      </View>
      <View style={{ flex: 1, gap: space[2] }}>
        <Text numberOfLines={1} style={[styles.title, unavailable && { color: c.muted }]}>
          {unavailable ? 'Track unavailable' : title || ' '}
        </Text>
        <Text numberOfLines={1} style={s.muted}>
          {artist || ' '}
          {release ? ' · release' : ''}
        </Text>
      </View>
      <View style={styles.right}>
        {entry.saved ? (
          <View style={styles.saved}>
            <Ionicons name="bookmark" size={12} color={c.accent} />
            <Text style={styles.savedText}>Saved</Text>
          </View>
        ) : (
          <Stars value={entry.halfStars || 0} size={12} />
        )}
        {entry.reviewed ? <Ionicons name="chatbubble-outline" size={13} color={c.muted} /> : null}
      </View>
    </Pressable>
  );
}

/** The latest diary entries on your own profile, with a link to the full diary. */
export function DiaryPreview() {
  const diary = useDiary();
  const months: DiaryMonth[] = [];
  let left = PREVIEW;
  for (const month of diary.months) {
    if (left <= 0) break;
    months.push({ ...month, entries: month.entries.slice(0, left) });
    left -= month.entries.length;
  }
  return (
    <Section
      title="Diary"
      right={
        diary.months.length ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/diary')}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space[12] }}
          >
            <Text style={s.link}>View diary</Text>
          </Pressable>
        ) : undefined
      }
    >
      <ErrorLine message={diary.error} />
      {months.map((month) => (
        <View key={month.key}>
          <DiaryMonthHeader month={month} />
          {month.entries.map((entry) => (
            <DiaryRow key={entry.key} entry={entry} />
          ))}
        </View>
      ))}
      {!diary.loading && !diary.months.length ? (
        <Text style={s.muted}>Rate or save a track and it shows up here.</Text>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  month: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[12],
    paddingTop: space[14],
    paddingBottom: space[8],
  },
  monthLabel: {
    color: c.text,
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.navigation,
    letterSpacing: tracking.brand,
  },
  monthCounts: { color: c.muted, fontSize: fontSize.label },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingVertical: space[10],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.line,
  },
  day: { width: 32, alignItems: 'center' },
  dayNumber: { color: c.text, fontSize: fontSize.section, fontWeight: fontWeight.bold },
  dayName: {
    color: c.muted,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.smallCaption,
    textTransform: 'uppercase',
  },
  art: { borderRadius: radius.medium, overflow: 'hidden' },
  title: { color: c.text, fontSize: fontSize.body, fontWeight: fontWeight.bold },
  right: { alignItems: 'flex-end', gap: space[4] },
  saved: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  savedText: { color: c.accent, fontSize: fontSize.label, fontWeight: fontWeight.medium },
});
