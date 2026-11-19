// Matches come from the server (get_matches: always fresh, computed for the signed-in user).
// One shared copy so Home, the list and the detail agree; re-fetched when a screen gains focus.
import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';

import { fetchMatches, type Match } from '@/data/matches';
import { useSession } from '@/features/auth/useSession';

export type { Match } from '@/data/matches';
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
    try {
      set({ status: 'ready', matches: await fetchMatches() });
    } catch {
      // Keep the last good list (offline): the screen shows a banner, not an empty list.
      set({ ...state, status: 'error' });
    }
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
