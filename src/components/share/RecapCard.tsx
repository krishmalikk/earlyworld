import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontWeight, radius, tracking } from '../../../shared/theme';
import {
  CARD,
  cardColors,
  cardLine,
  cardSpace,
  cardType,
  savesLabel,
} from '../../../shared/share-cards';
import { CardHeader, Moon, cardText } from './CardParts';

export type RecapCardProps = {
  username: string;
  monthLabel: string;
  foundAt: number;
  nowSaves: number;
  title: string;
  artistName: string;
  producerName: string | null;
  artworkUrl: string;
  ground?: string;
  onReady: (id: string) => void;
};

/** "You found it at N saves": the month's earliest find, on the lavender ground. */
export const RecapCard = forwardRef<View, RecapCardProps>(function RecapCard(
  {
    username,
    monthLabel,
    foundAt,
    nowSaves,
    title,
    artistName,
    producerName,
    artworkUrl,
    ground = colors.accent,
    onReady,
  },
  ref,
) {
  const first = foundAt === 0;
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: ground }]}>
      <View style={styles.progress}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[styles.bar, { backgroundColor: i < 3 ? colors.bg : cardColors.inkTrack }]}
          />
        ))}
      </View>
      <CardHeader label={monthLabel} ink={colors.bg} muted={colors.bg} />
      <Text style={[cardText.display, styles.headline]}>
        You found it at {savesLabel(foundAt)}.
      </Text>
      <View style={styles.system}>
        <View style={[styles.ring, styles.outer]} />
        <View style={[styles.ring, styles.inner]} />
        <Moon
          uri={artworkUrl}
          name={title}
          size={210}
          border={colors.bg}
          borderWidth={3}
          onReady={() => onReady('recap')}
          style={styles.moon}
        />
        <View style={styles.satellite} />
      </View>
      <View style={styles.track}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.credit} numberOfLines={1}>
          {artistName}
          {producerName ? ` · prod. ${producerName}` : ''}
        </Text>
      </View>
      <View style={styles.footer}>
        <View style={styles.now}>
          <Text style={[cardText.mono, styles.ink]}>NOW</Text>
          <Text style={[cardText.display, styles.number]}>{savesLabel(nowSaves)}</Text>
        </View>
        <Text style={styles.claim}>
          {first ? 'You were the first listener.' : `You were one of the first ${foundAt + 1}.`}
        </Text>
      </View>
      <Text style={[cardText.mono, styles.ink, styles.handle]}>@{username}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: CARD.width,
    height: CARD.height,
    paddingHorizontal: cardSpace.gutter,
    paddingTop: cardSpace.recap,
    paddingBottom: cardSpace.recapBottom,
    gap: cardSpace.recap,
    overflow: 'hidden',
  },
  progress: { flexDirection: 'row', gap: cardSpace.tight * 2 },
  bar: { flex: 1, height: 3, borderRadius: radius.small },
  headline: {
    color: colors.bg,
    fontSize: cardType.headline,
    lineHeight: cardLine.headline,
    letterSpacing: tracking.studio / 2,
  },
  system: { width: 312, height: 210, alignSelf: 'center' },
  ring: { position: 'absolute', borderRadius: radius.pill, transform: [{ rotate: '-14deg' }] },
  outer: {
    left: 0,
    top: 70,
    width: 312,
    height: 70,
    borderWidth: 1.5,
    borderColor: cardColors.inkRing,
  },
  inner: {
    left: 22,
    top: 82,
    width: 268,
    height: 46,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: cardColors.inkRingDim,
  },
  moon: {
    position: 'absolute',
    left: 51,
    top: 0,
    shadowColor: colors.bg,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 18 },
  },
  satellite: {
    position: 'absolute',
    left: 286,
    top: 66,
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
  },
  track: { alignItems: 'center', gap: cardSpace.tight * 2 },
  title: {
    color: colors.bg,
    fontSize: cardType.title,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  credit: { color: colors.bg, fontSize: cardType.meta, textAlign: 'center' },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1.5,
    borderTopColor: colors.bg,
    paddingTop: cardSpace.divider,
  },
  now: { gap: cardSpace.tight },
  ink: { color: colors.bg },
  number: { color: colors.bg, fontSize: cardType.number },
  claim: {
    maxWidth: 150,
    color: colors.bg,
    fontSize: cardType.meta,
    fontWeight: fontWeight.medium,
    textAlign: 'right',
    lineHeight: cardLine.claim,
  },
  handle: { textAlign: 'center', letterSpacing: tracking.metadata * 1.7 },
});
