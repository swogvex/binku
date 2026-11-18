// Incremental catalog pull from Supabase (read-only REST, public key) into SQLite.
import type { SQLiteDatabase } from 'expo-sqlite';

import { CATALOG_COLS, getKv, setKv, upsertRows, type CatalogTable } from './db';

const PAGE = 1000;
const ORDER: CatalogTable[] = [
  'country_config',
  'groups',
  'members',
  'releases',
  'versions',
  'cards',
];

type Row = Record<string, unknown> & { updated_at: string };
type FetchPage = (table: CatalogTable, since: string, offset: number) => Promise<Row[]>;

export function restFetcher(url: string, key: string, fetchImpl: typeof fetch = fetch): FetchPage {
  return async (table, since, offset) => {
    const cols = CATALOG_COLS[table].join(',');
    const q =
      `select=${cols}&updated_at=gt.${encodeURIComponent(since)}` +
      `&order=updated_at.asc&limit=${PAGE}&offset=${offset}`;
    const res = await fetchImpl(`${url}/rest/v1/${table}?${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`catalog pull ${table}: HTTP ${res.status}`);
    return (await res.json()) as Row[];
  };
}

/**
 * Pulls rows changed since the last cursor for every catalog table.
 * Rows with status 'hidden' are tombstones → deleted locally.
 * shortcut: pulls every group, not only followed ones; filter by followed groups when the
 * catalog grows past a few thousand cards.
 */
export async function pullCatalog(db: SQLiteDatabase, fetchPage: FetchPage) {
  let changed = 0;
  for (const table of ORDER) {
    const cursorKey = `sync:${table}`;
    const since = getKv(db, cursorKey) ?? '1970-01-01T00:00:00Z';
    let max = since;
    // Offset paging on a fixed `since`: a seed writes hundreds of rows with the same timestamp.
    for (let offset = 0; ; offset += PAGE) {
      const rows = await fetchPage(table, since, offset);
      const pk = table === 'country_config' ? 'country' : 'id';
      db.withTransactionSync(() => {
        const live = rows.filter((r) => r.status !== 'hidden');
        upsertRows(db, table, live);
        for (const r of rows)
          if (r.status === 'hidden')
            db.runSync(`delete from ${table} where ${pk} = ?`, String(r[pk]));
      });
      changed += rows.length;
      for (const r of rows) if (r.updated_at > max) max = r.updated_at;
      if (rows.length < PAGE) break;
    }
    setKv(db, cursorKey, max);
  }
  return changed;
}

/** Pulls when the public Supabase config is present; otherwise the bundled snapshot is used. */
export async function pullCatalogIfConfigured(db: SQLiteDatabase) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return 0;
  return pullCatalog(db, restFetcher(url, key));
}
