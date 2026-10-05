import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Stack, router } from 'expo-router';
import { useLocal } from '../../src/state/local';
import { c } from '../../src/components/ui';
import { fontSize, fontWeight, space } from '../../shared/theme';
export default function SettingsLayout() {
  const uid = useLocal((state) => state.uid);
  if (!uid) return <Redirect href="/" />;
  return (
    <Stack
      key={uid}
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerTitleStyle: { fontSize: fontSize.navigation, fontWeight: fontWeight.medium },
        contentStyle: { backgroundColor: c.bg },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Settings',
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to profile"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')
              }
              style={{ padding: space[12] }}
            >
              <Ionicons name="chevron-back" size={24} color={c.text} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="account" options={{ title: 'Account' }} />
      <Stack.Screen name="access" options={{ title: 'Community access' }} />
      <Stack.Screen name="blocked" options={{ title: 'Blocked listeners' }} />
      <Stack.Screen name="policy" options={{ title: 'Community information' }} />
      <Stack.Screen name="delete" options={{ title: 'Delete account' }} />
    </Stack>
  );
}
