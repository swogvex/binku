import { useMemo, useSyncExternalStore } from 'react';

import { dataVersion, loadCatalog, loadMarks } from '@/data/catalog';
import { getDb } from '@/data/db';

import { emptyFilter, filterCards, type Filter } from './filter';

/** All approved cards + the user's marks, re-read when sync or edits bump the data version. */
export function useCatalogData() {
  const v = useSyncExternalStore(dataVersion.subscribe, dataVersion.get);
  return useMemo(() => {
    const db = getDb();
    return { cards: loadCatalog(db), marks: loadMarks(db), v };
  }, [v]);
}

// Filter state shared by the catalog tab and the filters sheet route.
let filter: Filter = emptyFilter;
const listeners = new Set<() => void>();
const filterStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: () => filter,
};
export function setFilter(next: Partial<Filter>) {
  filter = { ...filter, ...next };
  listeners.forEach((fn) => fn());
}
export const useFilter = () => useSyncExternalStore(filterStore.subscribe, filterStore.get);

export function useFilteredCards() {
  const data = useCatalogData();
  const f = useFilter();
  const results = useMemo(() => filterCards(data.cards, f, data.marks), [data, f]);
  return { ...data, filter: f, results };
}
