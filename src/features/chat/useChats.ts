// Inbox from the server (get_chats). One shared copy so the Home badge and the Messages list
// agree; re-fetched when a screen gains focus and after sending or reading.
import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';

import { fetchChats, type Chat } from '@/data/chat';
import { useSession } from '@/features/auth/useSession';

type State = { status: 'loading' | 'ready' | 'error'; chats: Chat[] };

let state: State = { status: 'loading', chats: [] };
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
export function refreshChats() {
  inFlight ??= (async () => {
    try {
      set({ status: 'ready', chats: await fetchChats() });
    } catch {
      set({ ...state, status: 'error' }); // offline: keep the last list
    }
  })().finally(() => (inFlight = null));
  return inFlight;
}

/** null = no account (chat needs one). */
export function useChats() {
  const session = useSession();
  const s = useSyncExternalStore(subscribe, () => state);
  useFocusEffect(
    useCallback(() => {
      if (session) void refreshChats();
      else if (state.chats.length) set({ status: 'loading', chats: [] });
    }, [session]),
  );
  return session === null ? null : s;
}

export const unreadTotal = (chats: Chat[]) => chats.reduce((n, c) => n + c.unread, 0);
