import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  radius,
  space,
  tracking,
} from '../../shared/theme';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Track } from '../data/types';
import { colors as c, logoPalette } from '../../shared/brand';
import { s } from './ui';

type Lane = { role: string; artists: string[]; color: string };
const releaseRole = /^(label|distributor|publisher|copyright|phonographic copyright)/i;

export function StudioCredits({ track }: { track: Track }) {
  const [expanded, setExpanded] = useState(false);
  const credits = track.credits;
  if (track.geniusStatus !== 'matched' || !credits) return null;

  const lanes: Lane[] = [
    { role: 'Production', artists: credits.producers, color: c.accent },
    { role: 'Writing', artists: credits.writers, color: logoPalette.ice },
    ...credits.performances
      .filter((credit) => !releaseRole.test(credit.role))
      .map((credit, index) => ({
        role: credit.role,
        artists: credit.artists,
        color: index % 2 ? c.muted : c.highlight,
      })),
  ].filter((lane) => lane.artists.length);
  const releaseCredits = credits.performances.filter((credit) => releaseRole.test(credit.role));
  const visible = expanded ? lanes : lanes.slice(0, 5);

  return (
    <View style={{ gap: space[14] }}>
      <View style={s.between}>
        <View style={{ gap: space[5] }}>
          <Text accessibilityRole="header" style={styles.title}>
            The Studio
          </Text>
        </View>
        <View
          style={styles.sessionIcon}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Ionicons name="options-outline" size={24} color={c.accent} />
        </View>
      </View>

      {lanes.length > 0 ? (
        <View style={styles.board}>
          <View style={styles.toolbar}>
            <View style={[s.row, { gap: space[7] }]}>
              <View style={styles.light} />
              <Text style={styles.micro}>CREDITS</Text>
            </View>
            <Text style={styles.micro}>{lanes.length} LANES</Text>
          </View>
          <View
            style={styles.ruler}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={styles.channelLabel}>
              <Text style={styles.micro}>ROLE</Text>
            </View>
            <View style={styles.timeline}>
              {['01', '02', '03', '04'].map((bar) => (
                <Text key={bar} style={styles.barNumber}>
                  {bar}
                </Text>
              ))}
            </View>
          </View>
          {visible.map((lane, index) => (
            <View
              key={`${index}-${lane.role}`}
              style={styles.lane}
              accessible
              accessibilityLabel={`${lane.role}: ${lane.artists.join(', ')}`}
            >
              <View style={styles.channel}>
                <Text style={[styles.micro, { color: lane.color }]}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <Text style={styles.role}>{lane.role}</Text>
                <View style={[styles.channelMeter, { backgroundColor: lane.color }]} />
              </View>
              <View style={styles.clips}>
                <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false}>
                  <View style={styles.grid}>
                    {[0, 1, 2, 3].map((beat) => (
                      <View key={beat} style={styles.gridCell} />
                    ))}
                  </View>
                </View>
                {lane.artists.map((artist, artistIndex) => (
                  <View
                    key={`${artistIndex}-${artist}`}
                    style={[
                      styles.clip,
                      {
                        marginLeft: ((index + artistIndex) % 3) * space[10],
                        marginRight: ((index + artistIndex + 1) % 3) * space[8],
                        borderColor: `${lane.color}66`,
                        borderLeftColor: lane.color,
                        backgroundColor: `${lane.color}20`,
                      },
                    ]}
                  >
                    <Text style={[styles.artist, { color: lane.color }]}>{artist}</Text>
                    <View style={styles.notes} accessible={false}>
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((note) => (
                        <View
                          key={note}
                          style={{
                            width: note % 3 === index % 3 ? 16 : 7,
                            height: 3,
                            marginTop: (note + index) % 3 === 0 ? space[4] : space[0],
                            backgroundColor: lane.color,
                            opacity: note % 3 === 0 ? 0.65 : 0.25,
                          }}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
          {lanes.length > 5 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                expanded ? 'Collapse arrangement' : `Show all ${lanes.length} lanes`
              }
              accessibilityState={{ expanded }}
              onPress={() => setExpanded(!expanded)}
              style={({ pressed }) => [styles.expand, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[s.link, { fontWeight: fontWeight.medium }]}>
                {expanded ? 'Collapse arrangement' : `Show all ${lanes.length} lanes`}
              </Text>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={c.accent}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {credits.album || credits.releaseDate || releaseCredits.length ? (
        <View style={styles.release}>
          <Text style={s.mono}>RELEASE NOTES</Text>
          {credits.album ? (
            <Text style={[s.text, { fontWeight: fontWeight.medium }]}>{credits.album}</Text>
          ) : null}
          {credits.releaseDate ? <Text style={s.muted}>Released {credits.releaseDate}</Text> : null}
          {releaseCredits.map((credit, index) => (
            <View key={`${index}-${credit.role}`} style={{ gap: space[2] }}>
              <Text style={[s.muted, { fontSize: fontSize.caption }]}>{credit.role}</Text>
              <Text style={[s.text, { fontSize: fontSize.label }]}>
                {credit.artists.join(', ')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {track.geniusUrl ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="View credits on Genius"
          onPress={() => Linking.openURL(track.geniusUrl!)}
          style={({ pressed }) => [styles.attribution, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={s.link}>Credits via Genius</Text>
          <Ionicons name="arrow-up-right-box-outline" size={14} color={c.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: c.text,
    fontSize: fontSize.studio,
    fontWeight: fontWeight.heavy,
    letterSpacing: tracking.studio,
  },
  sessionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.large,
    backgroundColor: c.selected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  board: {
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: radius.medium,
    overflow: 'hidden',
  },
  toolbar: {
    padding: space[12],
    gap: space[8],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.artworkBg,
  },
  light: { width: 5, height: 5, borderRadius: radius.small, backgroundColor: c.accent },
  micro: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.micro,
    letterSpacing: tracking.micro,
    color: c.muted,
  },
  ruler: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.line },
  channelLabel: { width: 90, padding: space[10], justifyContent: 'center' },
  timeline: { flex: 1, flexDirection: 'row' },
  barNumber: {
    flex: 1,
    paddingVertical: space[9],
    paddingLeft: space[6],
    borderLeftWidth: 1,
    borderLeftColor: c.line,
    color: c.muted,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.micro,
  },
  lane: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.line, minHeight: 78 },
  channel: {
    width: 90,
    padding: space[10],
    gap: space[7],
    backgroundColor: c.panel,
    borderRightWidth: 1,
    borderRightColor: c.line,
  },
  role: {
    color: c.text,
    fontSize: fontSize.smallLabel,
    lineHeight: lineHeight.caption,
    fontWeight: fontWeight.medium,
  },
  channelMeter: { width: 18, height: 2, opacity: 0.6 },
  clips: {
    flex: 1,
    paddingVertical: space[10],
    paddingHorizontal: space[7],
    justifyContent: 'center',
    gap: space[6],
  },
  grid: { flex: 1, flexDirection: 'row' },
  gridCell: { flex: 1, borderRightWidth: 1, borderRightColor: `${c.line}88` },
  clip: {
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: radius.small,
    paddingHorizontal: space[9],
    paddingVertical: space[8],
    gap: space[8],
  },
  artist: { fontSize: fontSize.label, lineHeight: lineHeight.label, fontWeight: fontWeight.medium },
  notes: { height: 7, flexDirection: 'row', gap: space[3], overflow: 'hidden' },
  expand: {
    minHeight: 46,
    padding: space[12],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space[8],
  },
  release: {
    gap: space[9],
    borderLeftWidth: 2,
    borderLeftColor: c.line,
    paddingLeft: space[14],
    paddingVertical: space[4],
  },
  attribution: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[6] },
});
