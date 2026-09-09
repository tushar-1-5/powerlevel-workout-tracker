import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { openDatabase } from '@/db/client';
import { ensureSeeded } from '@/db/seed';
import { getSettings } from '@/queries/settings';
import { colors, font, spacing } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout.
 *
 * Nothing in the app is allowed to render until the database is open and
 * migrated, because every screen below queries it synchronously via `getDb()`.
 * Gating here means no screen needs its own "is the DB ready?" branch.
 */
export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Open -> migrate -> seed the exercise library -> load settings, in that
    // order. No screen renders until all steps are done, so nothing below has
    // to handle a half-initialised app. Splits are NOT seeded here — creating
    // the first one is onboarding's job (Today redirects there when
    // `settings.onboarded` is false), and the exercise library still has to
    // exist first since onboarding's templates reference it by name.
    openDatabase()
      .then(() => ensureSeeded())
      .then(() => getSettings())
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        void SplashScreen.hideAsync();
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {error ? (
          <View style={styles.centre}>
            <Text style={styles.errorTitle}>Database failed to open</Text>
            <Text style={styles.errorBody}>{error.message}</Text>
          </View>
        ) : !ready ? (
          <View style={styles.centre}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
            }}
          />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.xl,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: font.heading,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  errorBody: {
    color: colors.textSecondary,
    fontSize: font.body,
    textAlign: 'center',
  },
});
