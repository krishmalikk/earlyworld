import { space } from '../../shared/theme';
import { Pressable } from 'react-native';
import { router, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Profile } from '../../src/components/Profile';
import { c } from '../../src/components/ui';
import { useLocal } from '../../src/state/local';
export default function MyProfile() {
  const uid = useLocal((s) => s.uid);
  return (
    <>
      <Tabs.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              onPress={() => router.push('/settings')}
              hitSlop={8}
              style={{ paddingHorizontal: space[16] }}
            >
              <Ionicons name="settings-outline" size={24} color={c.text} />
            </Pressable>
          ),
        }}
      />
      {uid ? <Profile uid={uid} /> : null}
    </>
  );
}
