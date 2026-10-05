import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  radius,
  space,
  tracking,
} from '../../shared/theme';
import { WelcomeOrbit } from './WelcomeOrbit';
import { s } from './ui';

export function WelcomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableHeight = height - insets.top - insets.bottom;
  const orbitHeight = Math.min(580, Math.max(320, availableHeight * 0.58));
  return (
    <SafeAreaView style={s.page}>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <WelcomeOrbit width={width - insets.left - insets.right} height={orbitHeight} />
        <View style={styles.intro}>
          <View style={styles.copy}>
            <Text accessibilityRole="header" style={styles.title}>
              Your taste.{'\n'}Your people.
            </Text>
            <Text style={styles.description}>
              Discover underground rap, rate your favorites, and find people who get it.
            </Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get started"
              onPress={() => router.push({ pathname: '/auth', params: { mode: 'signup' } })}
              style={({ pressed }) => [styles.start, { opacity: pressed ? 0.75 : 1 }]}
            >
              <Text style={styles.startText}>Get started</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.bg} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Already have an account? Sign in"
              onPress={() => router.push('/auth')}
              style={styles.signIn}
            >
              <Text style={styles.signInText}>
                Already here? <Text style={styles.signInLink}>Sign in</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: space[8] },
  intro: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: space[28],
    paddingTop: space[12],
    justifyContent: 'space-between',
    gap: space[24],
  },
  copy: { alignItems: 'center', gap: space[12] },
  title: {
    color: colors.text,
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.brandHero,
    letterSpacing: tracking.title,
    textAlign: 'center',
  },
  description: {
    color: colors.muted,
    fontSize: fontSize.body,
    lineHeight: lineHeight.content,
    textAlign: 'center',
    maxWidth: 300,
  },
  actions: { gap: space[6] },
  start: {
    minHeight: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: space[24],
    paddingVertical: space[16],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[12],
  },
  startText: { color: colors.bg, fontSize: fontSize.trackTitle, fontWeight: fontWeight.bold },
  signIn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[10],
  },
  signInText: { color: colors.muted, fontSize: fontSize.navigation },
  signInLink: { color: colors.text, fontWeight: fontWeight.bold },
});
