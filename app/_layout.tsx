import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getAnalytics, logScreenView } from '@react-native-firebase/analytics';
import { SessionProvider, useSession } from '../src/data/session';
import { SavesProvider } from '../src/data/saves';
import { CatalogProvider } from '../src/data/catalog';
import { useLocal } from '../src/state/local';
import { c } from '../src/components/ui';
import { report } from '../src/lib/firebase';
export { ErrorBoundary } from 'expo-router';
function Navigation() {
  const router = useRouter(),
    segments = useSegments(),
    uid = useLocal((s) => s.uid),
    { user, loading } = useSession();
  const group = segments[0];
  useEffect(() => {
    if (loading) return;
    if (!uid && group !== 'auth') router.replace('/auth');
    else if (uid && (!user || !user.onboardingComplete) && group !== 'onboarding')
      router.replace('/onboarding');
    else if (user?.onboardingComplete && (group === 'auth' || group === 'onboarding' || !group))
      router.replace('/(tabs)/matches');
  }, [uid, user?.onboardingComplete, loading, group, router]);
  useEffect(() => {
    logScreenView(getAnalytics(), { screen_name: segments.join('/') || 'index' }).catch(report);
  }, [segments.join('/')]);
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerTitleStyle: { fontSize: 13, fontWeight: '600' },
        contentStyle: { backgroundColor: c.bg },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="track/[id]" options={{ title: 'TRACK / CREDITS' }} />
      <Stack.Screen name="entity/[id]" options={{ title: 'IN THE CATALOG' }} />
      <Stack.Screen name="user/[id]" options={{ title: 'EARLYWORLD / PROFILE' }} />
    </Stack>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SessionProvider>
        <CatalogProvider>
          <SavesProvider>
            <Navigation />
          </SavesProvider>
        </CatalogProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
