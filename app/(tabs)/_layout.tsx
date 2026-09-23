import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { c } from '../../src/components/ui';
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerTitle: 'earlyworld',
        headerTitleAlign: 'left',
        headerTitleStyle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.8 },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.line, height: 80, paddingTop: 8 },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontSize: 9, letterSpacing: 0.5 },
      }}
    >
      {(
        [
          { name: 'index', title: 'Feed', icon: 'albums-outline' },
          { name: 'discover', title: 'Discover', icon: 'search-outline' },
          { name: 'add', title: 'Add track', icon: 'add-circle-outline' },
          { name: 'matches', title: 'Matches', icon: 'git-compare-outline' },
          { name: 'profile', title: 'Profile', icon: 'person-outline' },
        ] as const
      ).map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={t.icon} size={size - 3} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
