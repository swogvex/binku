import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { dataVersion } from '@/data/catalog';
import { pullCatalogIfConfigured } from '@/data/catalogSync';
import { getDb } from '@/data/db';
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
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="gallery" />
        <Stack.Screen name="sheet-demo" options={sheetOptions} />
        <Stack.Screen name="catalog-filters" options={sheetOptions} />
        <Stack.Screen name="card/[id]" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default Sentry.wrap(RootLayout);
