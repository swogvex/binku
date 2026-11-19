// Match alerts (11-notifications-deeplinks). Permission is asked only when the user turns
// "Avisos de coincidencias" on; the server decides what to send and when (quiet hours).
import Constants from 'expo-constants';
import { getCalendars } from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { locale } from '@/i18n';
import {
  fetchAlertSettings,
  registerDevice,
  unregisterDevice,
  updateMyProfile,
  type Quiet,
} from '@/data/matches';

export type { Quiet };

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
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('messages', {
      name: locale === 'es' ? 'Mensajes' : 'Messages',
      importance: AndroidImportance.HIGH,
    });
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

/** Asks the system permission and links this phone to the account. False if refused. */
async function registerThisPhone() {
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return false;
  await registerDevice({
    token: await token(),
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    lang: locale,
    timezone: getCalendars()[0]?.timeZone ?? 'Europe/Madrid',
  });
  return true;
}

/** Turns alerts on. Returns false if the user refused the system permission. */
export async function enableMatchAlerts() {
  if (!(await registerThisPhone())) return false;
  await updateMyProfile({ notify_matches: true });
  return true;
}

export const disableMatchAlerts = () => updateMyProfile({ notify_matches: false });

export async function enableMessageAlerts() {
  if (!(await registerThisPhone())) return false;
  await updateMyProfile({ notify_messages: true });
  return true;
}
export const disableMessageAlerts = () => updateMyProfile({ notify_messages: false });

/**
 * After the first message the user sends: ask once for the permission so replies can reach
 * them (message alerts are on by default on the server). Never asks again if they said no.
 */
export async function offerMessageAlerts() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'denied') await registerThisPhone(); // granted: just refreshes the token
  } catch {
    // offline or no push service: alerts can be turned on in Settings later
  }
}
export const setQuietHours = (q: Quiet) => updateMyProfile({ quiet_hours: q });

export const loadAlertSettings = fetchAlertSettings;

/** Before signing out: this phone stops receiving that account's alerts. */
export async function forgetThisDevice() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') await unregisterDevice(await token());
  } catch {
    // offline or no push service: the server drops the token when it moves to another account
  }
}
