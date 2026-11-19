// The user's match scope (25-international): Mi zona / Mi país (default) / Mi región / Internacional.
import { useSyncExternalStore } from 'react';

import { updateMyProfile, type Scope } from '@/data/matches';
import { fetchProfile } from '@/features/auth/account';

export type { Scope };

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
  await updateMyProfile({ match_scope: s });
  set(s);
}
