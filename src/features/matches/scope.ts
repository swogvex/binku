// The user's match scope (25-international): Mi zona / Mi país (default) / Mi región / Internacional.
import { useSyncExternalStore } from 'react';

import { fetchProfile, type ServerProfile } from '@/features/auth/account';
import { supabase } from '@/lib/supabase';

export type Scope = ServerProfile['match_scope'];

let scope: Scope | undefined;
const listeners = new Set<() => void>();
const set = (s: Scope) => {
  scope = s;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  if (scope === undefined)
    fetchProfile().then(
      (p) => p && set(p.match_scope),
      () => {},
    );
  return () => void listeners.delete(l);
};

export const useMatchScope = () => useSyncExternalStore(subscribe, () => scope);

export async function setMatchScope(s: Scope) {
  const { data } = await supabase.auth.getSession();
  const { error } = await supabase
    .from('profiles')
    .update({ match_scope: s })
    .eq('id', data.session!.user.id);
  if (error) throw error;
  set(s);
}
