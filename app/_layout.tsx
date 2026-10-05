import { fontSize, fontWeight } from '../shared/theme';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments, useGlobalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getAnalytics, logScreenView } from '@react-native-firebase/analytics';
import { SessionProvider, useSession } from '../src/data/session';
import { RatingsProvider } from '../src/data/ratings';
import { SavesProvider } from '../src/data/saves';
import { CatalogProvider } from '../src/data/catalog';
import { useLocal } from '../src/state/local';
import { c, s } from '../src/components/ui';
import { report } from '../src/lib/firebase';
import { SocialProvider } from '../src/data/social';
import { InboxProvider } from '../src/data/inbox';
import { startupRedirect } from '../shared/startup';
export { ErrorBoundary } from 'expo-router';
function Navigation() {
  const router = useRouter(),
    segments = useSegments(),
    uid = useLocal((s) => s.uid),
    { user, loading } = useSession();
  const group = segments[0];
  const { id: linkedId } = useGlobalSearchParams<{ id?: string }>();
  const pendingPostId = useLocal((s) => s.pendingPostId);
  useEffect(() => {
    if (loading) return;
    const destination = startupRedirect({
      signedIn: !!uid,
      onboardingComplete: !!user?.onboardingComplete,
      group,
    });
    if (
      !uid &&
      group === 'post' &&
      typeof linkedId === 'string' &&
      /^[a-zA-Z0-9_-]{1,128}$/.test(linkedId)
    )
      useLocal.getState().setPendingPostId(linkedId);
    if (uid && user?.onboardingComplete && pendingPostId) {
      useLocal.getState().setPendingPostId(null);
      router.replace(`/post/${pendingPostId}`);
    } else if (destination) router.replace(destination);
  }, [uid, user?.onboardingComplete, loading, group, router, linkedId, pendingPostId]);
  useEffect(() => {
    logScreenView(getAnalytics(), { screen_name: segments.join('/') || 'index' }).catch(report);
  }, [segments.join('/')]);
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerTitleStyle: { fontSize: fontSize.navigation, fontWeight: fontWeight.medium },
        contentStyle: { backgroundColor: c.bg },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="post/[id]" options={{ title: 'Post' }} />
      <Stack.Screen name="videos" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="community" options={{ title: 'Community' }} />
      <Stack.Screen name="moderation" options={{ title: 'Moderation' }} />
      <Stack.Screen name="release/[id]" options={{ title: 'Release' }} />
      <Stack.Screen name="user/releases/[id]" options={{ title: 'Release reviews' }} />
      <Stack.Screen name="track/[id]" options={{ title: 'Track' }} />
      <Stack.Screen name="entity/[id]" options={{ title: 'Artist & producer' }} />
      <Stack.Screen name="user/ratings/[id]" options={{ title: 'Ratings & reviews' }} />
      <Stack.Screen name="user/[id]" options={{ title: 'Profile' }} />
      <Stack.Screen name="matches" options={{ title: 'Matches' }} />
      <Stack.Screen name="messages/new" options={{ title: 'New message' }} />
      <Stack.Screen name="messages/requests" options={{ title: 'Message requests' }} />
      <Stack.Screen name="messages/[id]" options={{ title: '' }} />
      <Stack.Screen name="messages/info/[id]" options={{ title: 'Details' }} />
    </Stack>
  );
}
export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({
    'Panchang-Regular': require('../assets/fonts/panchang/Panchang-Regular.otf'),
    'Panchang-Medium': require('../assets/fonts/panchang/Panchang-Medium.otf'),
    'Panchang-Bold': require('../assets/fonts/panchang/Panchang-Bold.otf'),
  });
  useEffect(() => {
    if (fontError) report(fontError);
  }, [fontError]);
  if (!fontsLoaded && !fontError)
    return (
      <View style={[s.page, { alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar style="light" />
        <ActivityIndicator color={c.accent} accessibilityLabel="Opening earlyworld" />
      </View>
    );
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SessionProvider>
        <CatalogProvider>
          <SavesProvider>
            <RatingsProvider>
              <SocialProvider>
                <InboxProvider>
                  <Navigation />
                </InboxProvider>
              </SocialProvider>
            </RatingsProvider>
          </SavesProvider>
        </CatalogProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
