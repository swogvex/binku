// Account set-up after the email code: profile from the local onboarding, @username, error copy.
import * as Sentry from '@sentry/react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { forgetDob, getLocalProfile } from '@/data/profile';
import { fold } from '@/features/catalog/filter';
import type { TKey } from '@/i18n';
import { supabase } from '@/lib/supabase';

/** Same rule as the `profiles.username` check in the database. */
export const USERNAME = /^[a-z0-9_.]{3,20}$/;

/**
 * Creates the profile on first sign-in (the server re-checks the age gate) and then deletes the
 * DOB from the device. Returns the @username, or null when the user still has to pick one.
 */
export async function ensureProfile(db: SQLiteDatabase): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('username').maybeSingle();
  if (error) throw error;
  if (!data) {
    const local = getLocalProfile(db);
    // shortcut: a second new account on a phone whose DOB was already uploaded fails here; ask the DOB again if that shows up in Sentry.
    if (!local?.dob) throw new Error('No local date of birth to create the profile');
    // shortcut: currency stays the EUR default; set it per country when LatAm launches (M10b).
    const { error: insertError } = await supabase.from('profiles').insert({
      birth_date: local.dob,
      country: local.country,
      subdivision: local.subdivision || null,
    });
    if (insertError) throw insertError;
  }
  forgetDob(db);
  return data?.username ?? null;
}

/** bias member + 4 digits (never the email: it may hold a real name, and many users are minors). */
export function suggestUsername(db: SQLiteDatabase) {
  const memberId = Object.values(getLocalProfile(db)?.bias ?? {}).find((id) => id !== 'all');
  const row = memberId
    ? db.getFirstSync<{ name: string }>('select name from members where id = ?', memberId)
    : null;
  const base =
    fold(row?.name ?? '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 14) || 'binku';
  return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function saveUsername(username: string) {
  const { data } = await supabase.auth.getSession();
  const { error } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', data.session!.user.id);
  if (error) throw error;
}

export function authErrorKey(e: unknown): TKey {
  const err = e as { code?: string; name?: string } | null;
  if (e instanceof TypeError || err?.name === 'AuthRetryableFetchError')
    return 'auth.errors.offline';
  switch (err?.code) {
    case '23505':
      return 'auth.errors.taken';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'auth.errors.rateLimit';
    case 'otp_expired':
      return 'auth.errors.badCode';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'auth.errors.badEmail';
  }
  Sentry.captureException(e);
  return 'auth.errors.generic';
}
