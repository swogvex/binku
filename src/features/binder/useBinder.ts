import { useMemo } from 'react';

import { listBinders, loadOrder } from '@/data/binders';
import { dataVersion } from '@/data/catalog';
import { getDb, getKv, setKv } from '@/data/db';
import { useCatalogData } from '@/features/catalog/useCatalog';

import { binderCards } from './pages';

/**
 * Binders + the selected binder's cards in order. Keyed on the catalog data object, which
 * changes on every edit, so the React Compiler never keeps a stale read of the DB.
 */
const CURRENT_KEY = 'binder:current';

/** Remembers the open binder across launches (also set by the "Nuevo binder" sheet). */
export function selectBinder(id: string) {
  setKv(getDb(), CURRENT_KEY, id);
  dataVersion.bump();
}

export function useBinder() {
  const data = useCatalogData();
  return useMemo(() => {
    const db = getDb();
    const binders = listBinders(db);
    const selectedId = getKv(db, CURRENT_KEY);
    const binder = binders.find((b) => b.id === selectedId) ?? binders[0];
    const items = binder ? binderCards(data.cards, binder.filter, loadOrder(db, binder.id)) : [];
    return { ...data, binders, binder, items };
  }, [data]);
}
