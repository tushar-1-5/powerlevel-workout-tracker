import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, glass, spacing } from '@/theme/tokens';

/**
 * The 4 bottom tabs — Today, History, Stats, Settings. Settings joined as a
 * tab (moved from a pushed route reached via the overflow menu) so it's
 * always one tap away rather than a menu-hunt — a real bottom-tab set now,
 * not the 3-tab-plus-menu shape the PRD originally sketched.
 *
 * Icons via Ionicons (`@expo/vector-icons`) — filled when the tab is active,
 * outline otherwise, standard convention. This needed no EAS rebuild:
 * `@expo/vector-icons` is pure JS plus bundled font assets, built on
 * `expo-font`, which was already installed and already compiled into the
 * dev client before this was added.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: glass.panelRaised,
          borderTopWidth: 1,
          borderTopColor: glass.borderStrong,
          elevation: 0,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: spacing.xs,
        },
        tabBarLabelStyle: {
          fontSize: font.micro,
          fontWeight: '700',
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
