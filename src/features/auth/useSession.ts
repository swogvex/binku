import type { Session } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';

// undefined = still reading the stored session; null = signed out.
let session: Session | null | undefined;
const listeners = new Set<() => void>();

supabase.auth.onAuthStateChange((_event, s) => {
  session = s;
  listeners.forEach((l) => l());
});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const useSession = () => useSyncExternalStore(subscribe, () => session);
