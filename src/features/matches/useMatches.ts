// Matches come from the server (get_matches: always fresh, computed for the signed-in user).
// One shared copy so Home, the list and the detail agree; re-fetched when a screen gains focus.
import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/useSession';

export type Match = {
  user_id: string;
  username: string;
  country: string;
  subdivision: string | null;
  kind: 'double' | 'single';
  they_give: string[];
  you_give: string[];
  /** 0 same subdivision · 1 same country · 2 same region · 3 elsewhere */
  proximity: number;
};
type State = { status: 'loading' | 'ready' | 'error'; matches: Match[] };

let state: State = { status: 'loading', matches: [] };
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

let inFlight: Promise<void> | null = null;
export function refreshMatches() {
  inFlight ??= (async () => {
    const { data, error } = await supabase.rpc('get_matches');
    // Keep the last good list on errors (offline): the screen shows a banner, not an empty list.
    set(
      error ? { ...state, status: 'error' } : { status: 'ready', matches: (data ?? []) as Match[] },
    );
  })().finally(() => (inFlight = null));
  return inFlight;
}

/** null = no account (matches need one). */
export function useMatches() {
  const session = useSession();
  const s = useSyncExternalStore(subscribe, () => state);
  useFocusEffect(
    useCallback(() => {
      if (session) void refreshMatches();
      else if (state.matches.length) set({ status: 'loading', matches: [] }); // signed out: forget them
    }, [session]),
  );
  return session === null ? null : s;
}

export const findMatch = (userId: string) => state.matches.find((m) => m.user_id === userId);
