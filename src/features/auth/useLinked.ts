import { useSyncExternalStore } from 'react';

import { dataVersion } from '@/data/catalog';
import { getDb, getKv } from '@/data/db';

/** Account this phone's collection is linked to (kv `sync:user`), re-read on every data change. */
export function useLinkedUser() {
  // The compiler would cache getKv(getDb(), …) by its constant arguments and miss link changes.
  'use no memo';
  useSyncExternalStore(dataVersion.subscribe, dataVersion.get);
  return getKv(getDb(), 'sync:user');
}
