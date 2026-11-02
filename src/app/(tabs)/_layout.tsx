import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarIcon, ChartIcon, ListIcon, SlidersIcon } from '@/components/icons';
import { useGeofencing } from '@/geofence/useGeofencing';
import { useClockOutReminder } from '@/notifications/useReminder';
import { MIN_TAP, space, useTheme } from '@/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Keeps the clock-out reminder scheduled while the app runs (CLAUDE.md §3.8).
  useClockOutReminder();
  // Arrive-and-leave questions (Android; CLAUDE.md §3.11).
  useGeofencing();
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: MIN_TAP + space.lg + insets.bottom,
          paddingTop: space.sm,
          paddingBottom: insets.bottom + space.sm,
        },
        tabBarItemStyle: { minHeight: MIN_TAP },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Week',
          tabBarAccessibilityLabel: 'Week, log your time',
          tabBarIcon: ({ color }) => <CalendarIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: 'Summary',
          tabBarAccessibilityLabel: 'Summary and all weeks',
          tabBarIcon: ({ color }) => <ListIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="charts"
        options={{
          title: 'Charts',
          tabBarAccessibilityLabel: 'Charts of hours per day and week',
          tabBarIcon: ({ color }) => <ChartIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings',
          tabBarIcon: ({ color }) => <SlidersIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
