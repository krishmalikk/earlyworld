import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, fontWeight, radius } from '../../../shared/theme';
import {
  CARD,
  cardColors,
  cardLine,
  cardSpace,
  cardType,
  initials,
} from '../../../shared/share-cards';
import { Backdrop, CardHeader, Moon, StarRow, cardText } from './CardParts';

export type ReviewCardProps = {
  username: string;
  title: string;
  artistName: string;
  producerName: string | null;
  artworkUrl: string;
  halfStars: number;
  review: string;
  /** e.g. "saved it at 0 saves" or "rated Oct 5". */
  detail: string;
  stamp: string;
  accent?: string;
  onReady: (id: string) => void;
};

/** One review as a card: the track as a moon, the stars, and the words in large type. */
export const ReviewCard = forwardRef<View, ReviewCardProps>(function ReviewCard(
  {
    username,
    title,
    artistName,
    producerName,
    artworkUrl,
    halfStars,
    review,
    detail,
    stamp,
    accent = colors.accent,
    onReady,
  },
  ref,
) {
  // Long reviews step down in size so the quote always fits its block.
  const quoteSize =
    review.length > 160
      ? cardType.handle
      : review.length > 70
        ? cardType.number - 4
        : cardType.quote;
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <Backdrop waveTop={524} accent={accent} />
      <CardHeader label="TRACK REVIEW" />
      <View style={styles.trackRow}>
        <View style={styles.orbit}>
          <View style={styles.ring} />
          <Moon
            uri={artworkUrl}
            name={title}
            size={100}
            border={accent}
            onReady={() => onReady('review')}
            style={styles.moon}
          />
          <View style={[styles.satellite, { backgroundColor: accent }]} />
        </View>
        <View style={styles.credits}>
          <Text style={styles.title} numberOfLines={3}>
            {title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {artistName}
          </Text>
          {producerName ? (
            <Text style={[styles.producer, { color: accent }]} numberOfLines={1}>
              prod. {producerName}
            </Text>
          ) : null}
        </View>
      </View>
      <StarRow halfStars={halfStars} size={26} color={accent} />
      <View style={styles.quoteBlock}>
        <Text style={[cardText.display, styles.quoteMark, { color: accent }]}>“</Text>
        <Text
          style={[
            cardText.display,
            styles.quote,
            { fontSize: quoteSize, lineHeight: quoteSize * 1.12 },
          ]}
          numberOfLines={7}
        >
          {review}
        </Text>
      </View>
      <View style={styles.spacer} />
      <View style={styles.footer}>
        <View style={styles.person}>
          <View style={styles.avatar}>
            <Text style={[styles.avatarText, { color: accent }]}>{initials(username)}</Text>
          </View>
          <View style={styles.personText}>
            <Text style={styles.handle}>@{username}</Text>
            <Text style={styles.detail}>{detail}</Text>
          </View>
        </View>
        <Text style={[cardText.mono, styles.stamp]}>{stamp}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: CARD.width,
    height: CARD.height,
    padding: cardSpace.gutter,
    gap: cardSpace.section,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: cardSpace.section - 2 },
  orbit: { width: 124, height: 124 },
  ring: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 124,
    height: 124,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: cardColors.ringStrong,
  },
  moon: { position: 'absolute', left: 12, top: 12 },
  satellite: {
    position: 'absolute',
    left: 101,
    top: 14,
    width: 9,
    height: 9,
    borderRadius: radius.pill,
  },
  credits: { flex: 1, minWidth: 0, gap: cardSpace.tight * 2 },
  title: {
    color: colors.text,
    fontSize: cardType.title,
    fontWeight: fontWeight.bold,
    lineHeight: cardLine.title,
  },
  artist: { color: colors.muted, fontSize: cardType.credit },
  producer: { fontSize: cardType.body },
  quoteBlock: {
    flex: 1,
    justifyContent: 'center',
    gap: cardSpace.divider,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: cardSpace.section,
  },
  quoteMark: { fontSize: cardType.quoteMark, lineHeight: cardType.quoteMark },
  quote: { color: colors.text },
  spacer: { height: 56 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  person: { flexDirection: 'row', alignItems: 'center', gap: cardSpace.row + 1 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.selected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: cardType.body, fontWeight: fontWeight.bold },
  personText: { gap: cardSpace.tight / 2 },
  handle: { color: colors.text, fontSize: cardType.meta, fontWeight: fontWeight.medium },
  detail: { color: colors.muted, fontSize: cardType.small },
  stamp: { color: colors.muted, fontSize: cardType.micro, fontFamily: fontFamily.mono },
});
