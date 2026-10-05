import { fontFamily, fontSize, fontWeight, space, tracking } from '../../shared/theme';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomInsetHandledContext, c } from '../../src/components/ui';
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <BottomInsetHandledContext.Provider value={true}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.text,
          headerTitleAlign: 'left',
          headerTitleStyle: {
            fontSize: fontSize.section,
            fontWeight: fontWeight.heavy,
            letterSpacing: tracking.brand,
          },
          headerShadowVisible: false,
          tabBarStyle: {
            backgroundColor: c.bg,
            borderTopColor: c.line,
            height: 48 + insets.bottom,
            paddingTop: space[8],
          },
          tabBarActiveTintColor: c.accent,
          tabBarInactiveTintColor: c.muted,
          tabBarLabelStyle: { fontSize: fontSize.smallCaption, letterSpacing: tracking.eyebrow },
        }}
      >
        {(
          [
            { name: 'index', title: 'Feed', icon: 'albums-outline' },
            { name: 'discover', title: 'Discover', icon: 'search-outline' },
            { name: 'create', title: 'Create', icon: 'add-circle-outline' },
            { name: 'matches', title: 'Matches', icon: 'git-compare-outline' },
            { name: 'profile', title: 'Profile', icon: 'person-outline' },
          ] as const
        ).map((t) => (
          <Tabs.Screen
            key={t.name}
            name={t.name}
            options={{
              title: t.title,
              ...(t.name === 'index'
                ? {
                    headerTitle: 'earlyworld',
                    headerTitleStyle: {
                      fontSize: fontSize.brandCompact,
                      fontFamily: fontFamily.displayBold,
                      fontWeight: fontWeight.regular,
                      letterSpacing: tracking.brand,
                    },
                  }
                : {}),
              tabBarIcon: ({ color, size }) => (
                <Ionicons name={t.icon} size={size - 3} color={color} />
              ),
            }}
          />
        ))}
      </Tabs>
    </BottomInsetHandledContext.Provider>
  );
}
