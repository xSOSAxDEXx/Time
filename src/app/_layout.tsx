import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';

// Android's arrive-and-leave background task must be defined as the app loads.
import '@/geofence/task';
import { registerServiceWorker } from '@/pwa/registerServiceWorker';
import { useTheme } from '@/theme';

SplashScreen.setOptions({ duration: 400, fade: true });

export default function RootLayout() {
  const { scheme, colors } = useTheme();
  const navTheme: Theme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [scheme, colors]);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="day/[date]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="holidays" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
