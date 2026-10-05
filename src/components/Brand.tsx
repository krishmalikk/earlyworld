import { StyleSheet, Text } from 'react-native';
import { colors, fontFamily, fontSize, tracking } from '../../shared/theme';

export function Brand({ variant = 'header' }: { variant?: 'header' | 'hero' | 'loading' }) {
  return (
    <Text accessibilityRole="header" style={[styles.wordmark, styles[variant]]}>
      earlyworld
    </Text>
  );
}
const styles = StyleSheet.create({
  wordmark: {
    color: colors.text,
    fontFamily: fontFamily.displayBold,
    letterSpacing: tracking.brand,
  },
  header: { fontSize: fontSize.brandCompact },
  hero: { fontSize: fontSize.title, letterSpacing: tracking.brand },
  loading: { fontSize: fontSize.brandLoading },
});
