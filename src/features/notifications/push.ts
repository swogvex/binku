// Match alerts (11-notifications-deeplinks). Permission is asked only when the user turns
// "Avisos de coincidencias" on; the server decides what to send and when (quiet hours).
import Constants from 'expo-constants';
import { getCalendars } from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { locale } from '@/i18n';
import { supabase } from '@/lib/supabase';

export type Quiet = 'off' | '22:00-09:00' | '23:00-08:00' | null;

Notifications.setNotificationHandler({
  // In the foreground the app is already on screen: show a banner, no sound.
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function token() {
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('matches', {
      name: locale === 'es' ? 'Coincidencias' : 'Matches',
      importance: AndroidImportance.DEFAULT,
    });
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

async function saveProfile(values: { notify_matches?: boolean; quiet_hours?: Quiet }) {
  const { data } = await supabase.auth.getSession();
  const { error } = await supabase.from('profiles').update(values).eq('id', data.session!.user.id);
  if (error) throw error;
}

/** Turns alerts on. Returns false if the user refused the system permission. */
export async function enableMatchAlerts() {
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return false;
  const { error } = await supabase.rpc('register_device', {
    p_token: await token(),
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    p_lang: locale,
    p_timezone: getCalendars()[0]?.timeZone ?? 'Europe/Madrid',
  });
  if (error) throw error;
  await saveProfile({ notify_matches: true });
  return true;
}

export const disableMatchAlerts = () => saveProfile({ notify_matches: false });
export const setQuietHours = (q: Quiet) => saveProfile({ quiet_hours: q });

export async function loadAlertSettings() {
  const { data, error } = await supabase
    .from('profiles')
    .select('notify_matches,quiet_hours,is_minor')
    .maybeSingle<{ notify_matches: boolean; quiet_hours: Quiet; is_minor: boolean }>();
  if (error) throw error;
  return data;
}

/** Before signing out: this phone stops receiving that account's alerts. */
export async function forgetThisDevice() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') await supabase.rpc('unregister_device', { p_token: await token() });
  } catch {
    // offline or no push service: the server drops the token when it moves to another account
  }
}
