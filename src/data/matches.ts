// Server calls for matches and match alerts (data layer: screens and features never call
// Supabase directly). Matches are computed on the server for the signed-in user.
import { supabase } from '@/lib/supabase';

export type Scope = 'zone' | 'country' | 'region' | 'international';
export type Quiet = 'off' | '22:00-09:00' | '23:00-08:00' | null;
export type Match = {
  user_id: string;
  username: string;
  country: string;
  subdivision: string | null;
  they_give: string[];
  you_give: string[];
  /** 0 same subdivision · 1 same country · 2 same region · 3 elsewhere */
  proximity: number;
};

export async function fetchMatches() {
  const { data, error } = await supabase.rpc('get_matches');
  if (error) throw error;
  return (data ?? []) as Match[];
}

/** Updates the signed-in user's own profile settings (RLS pins it to them). */
export async function updateMyProfile(values: {
  match_scope?: Scope;
  notify_matches?: boolean;
  quiet_hours?: Quiet;
}) {
  const { data } = await supabase.auth.getSession();
  const { error } = await supabase.from('profiles').update(values).eq('id', data.session!.user.id);
  if (error) throw error;
}

export async function fetchAlertSettings() {
  const { data, error } = await supabase
    .from('profiles')
    .select('notify_matches,quiet_hours,is_minor')
    .maybeSingle<{ notify_matches: boolean; quiet_hours: Quiet; is_minor: boolean }>();
  if (error) throw error;
  return data;
}

export async function registerDevice(d: {
  token: string;
  platform: 'ios' | 'android';
  lang: string;
  timezone: string;
}) {
  const { error } = await supabase.rpc('register_device', {
    p_token: d.token,
    p_platform: d.platform,
    p_lang: d.lang,
    p_timezone: d.timezone,
  });
  if (error) throw error;
}

export async function unregisterDevice(token: string) {
  const { error } = await supabase.rpc('unregister_device', { p_token: token });
  if (error) throw error;
}
