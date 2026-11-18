import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { dataVersion } from '@/data/catalog';
import { pullCatalogIfConfigured } from '@/data/catalogSync';
import { getDb } from '@/data/db';
import { useOnboarded } from '@/features/onboarding/useOnboarded';
import { fontFiles } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { sheetOptions } from '@/ui/sheet';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
});

SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const c = useTheme();
  const [loaded, error] = useFonts(fontFiles);
  const onboarded = useOnboarded();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  useEffect(() => {
    // Offline is normal: the bundled/cached catalog keeps working. Report only server errors.
    pullCatalogIfConfigured(getDb())
      .then((changed) => changed > 0 && dataVersion.bump())
      .catch((e) => {
        if (!(e instanceof TypeError)) Sentry.captureException(e);
      });
  }, []);

  // If fonts fail we still render with system fonts rather than block the app.
  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        {/* Browsing never needs an account, only the one-time onboarding. */}
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="gallery" />
          <Stack.Screen name="sheet-demo" options={sheetOptions} />
          <Stack.Screen name="catalog-filters" options={sheetOptions} />
          <Stack.Screen name="card/[id]" />
          <Stack.Screen name="binder-new" options={sheetOptions} />
          <Stack.Screen name="binder-options" options={sheetOptions} />
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
