import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import { useLocales } from 'expo-localization';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useSyncExternalStore } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { dataVersion } from '@/data/catalog';
import { pullCatalogIfConfigured } from '@/data/catalogSync';
import { getDb, getKv } from '@/data/db';
import { startSync } from '@/data/sync';
import { useOnboarded } from '@/features/onboarding/useOnboarded';
import { chooseLanguage, languageChoice, LANGS, setLocale, type Lang } from '@/i18n';
import { fontFiles } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { sheetOptions } from '@/ui/sheet';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
});

SplashScreen.preventAutoHideAsync();

// The language picked in Settings is applied before the first screen renders.
const saved = getKv(getDb(), 'lang') as Lang | undefined;
chooseLanguage(saved && LANGS.includes(saved) ? saved : null);

function RootLayout() {
  const c = useTheme();
  const [loaded, error] = useFonts(fontFiles);
  const onboarded = useOnboarded();
  // Language picked in Settings, else the phone's: a change re-renders every screen.
  // The choice is part of the argument so the compiler never reuses a stale result.
  const chosen = useSyncExternalStore(languageChoice.subscribe, languageChoice.get);
  const phone = useLocales()[0]?.languageCode;
  const lang = setLocale(chosen ?? phone);

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
    startSync();
  }, []);

  // If fonts fail we still render with system fonts rather than block the app.
  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView key={lang} style={{ flex: 1 }}>
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
          <Stack.Screen name="settings" />
          <Stack.Screen name="scan-review" options={{ gestureEnabled: false }} />
          <Stack.Screen name="scan-pick" options={sheetOptions} />
          <Stack.Screen name="language" options={sheetOptions} />
          <Stack.Screen
            name="card-viewer"
            options={{
              presentation: 'fullScreenModal',
              animation: 'fade',
              contentStyle: { backgroundColor: '#000' },
            }}
          />
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
