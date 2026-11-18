import { useMemo, useSyncExternalStore } from 'react';

import { dataVersion } from '@/data/catalog';
import { getDb } from '@/data/db';
import { isOnboarded } from '@/data/profile';

/** Re-reads the flag whenever local data changes (the version is referenced so memoisation keys on it). */
export function useOnboarded() {
  const v = useSyncExternalStore(dataVersion.subscribe, dataVersion.get);
  return useMemo(() => v >= 0 && isOnboarded(getDb()), [v]);
}
