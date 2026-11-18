// Local SQLite store: catalog cache + the user's binder (works without account or network).
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import catalogJson from '@/content/catalog/catalog.json';

import { flattenCatalog, type CatalogFile } from './catalogFile';

/** Columns mirrored from Supabase (local copy keeps only what the app reads). */
export const CATALOG_COLS = {
  groups: ['id', 'name', 'name_ko', 'monogram', 'color', 'status', 'updated_at'],
  members: ['id', 'group_id', 'name', 'name_ko', 'birth_year', 'status', 'updated_at'],
  releases: ['id', 'group_id', 'title', 'kind', 'year', 'era_color', 'status', 'updated_at'],
  versions: ['id', 'release_id', 'label', 'updated_at'],
  cards: [
    'id',
    'group_id',
    'member_id',
    'release_id',
    'version_id',
    'type',
    'store',
    'year',
    'is_special',
    'status',
    'updated_at',
  ],
  country_config: [
    'country',
    'launched',
    'min_age',
    'minor_limit',
    'in_person_allowed',
    'quiet_hours_default',
    'updated_at',
  ],
} as const;
export type CatalogTable = keyof typeof CATALOG_COLS;

// Append-only: never edit a shipped entry, add a new one.
const MIGRATIONS = [
  `
  create table groups (id text primary key, name text not null, name_ko text, monogram text not null,
    color text not null, status text not null, updated_at text not null);
  create table members (id text primary key, group_id text not null, name text not null, name_ko text,
    birth_year integer, status text not null, updated_at text not null);
  create table releases (id text primary key, group_id text not null, title text not null, kind text not null,
    year integer not null, era_color text not null, status text not null, updated_at text not null);
  create table versions (id text primary key, release_id text not null, label text not null,
    updated_at text not null);
  create table cards (id text primary key, group_id text not null, member_id text not null,
    release_id text not null, version_id text, type text not null, store text, year integer not null,
    is_special integer not null, status text not null, updated_at text not null);
  create index cards_group on cards (group_id);
  create index cards_member on cards (member_id);
  create index cards_release on cards (release_id);
  create index members_group on members (group_id);
  create index releases_group on releases (group_id);
  create table country_config (country text primary key, launched integer not null, min_age integer not null,
    minor_limit integer not null, in_person_allowed integer not null, quiet_hours_default text not null,
    updated_at text not null);

  create table binders (id text primary key, title text not null, kind text not null, filter text,
    layout text not null default '3x3', sort integer not null default 0, updated_at text not null);
  create table binder_slots (id text primary key, binder_id text not null, page integer not null,
    position integer not null, card_id text not null, unique (binder_id, page, position));
  create table user_cards (id text primary key, card_id text not null unique, status text not null,
    qty integer not null default 1, updated_at text not null);

  -- small settings: sync cursors, onboarding answers (DOB stays on device until sign-up)
  create table kv (key text primary key, value text not null);
  `,
];

/** Oldest timestamp: bundled rows lose to anything the server sends. */
const EPOCH = '1970-01-01T00:00:00Z';

export function upsertRows(db: SQLiteDatabase, table: CatalogTable, rows: object[]) {
  const cols = CATALOG_COLS[table];
  const stmt = db.prepareSync(
    `insert or replace into ${table} (${cols.join(', ')}) values (${cols.map(() => '?').join(', ')})`,
  );
  try {
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      stmt.executeSync(
        cols.map((c) => {
          const v = r[c];
          return typeof v === 'boolean' ? Number(v) : ((v ?? null) as string | number | null);
        }),
      );
    }
  } finally {
    stmt.finalizeSync();
  }
}

function seedFromBundle(db: SQLiteDatabase) {
  const rows = flattenCatalog(catalogJson as CatalogFile);
  for (const table of ['groups', 'members', 'releases', 'versions', 'cards'] as const) {
    upsertRows(
      db,
      table,
      rows[table].map((r) => ({ ...r, updated_at: EPOCH })),
    );
  }
  // Fallback until the first pull; server values win afterwards.
  upsertRows(db, 'country_config', [
    {
      country: 'ES',
      launched: true,
      min_age: 14,
      minor_limit: 18,
      in_person_allowed: true,
      quiet_hours_default: '22:00-09:00',
      updated_at: EPOCH,
    },
  ]);
}

export function migrate(db: SQLiteDatabase) {
  const { user_version: from } = db.getFirstSync<{ user_version: number }>('pragma user_version')!;
  if (from >= MIGRATIONS.length) return;
  db.withTransactionSync(() => {
    MIGRATIONS.slice(from).forEach((sql) => db.execSync(sql));
    if (from === 0) seedFromBundle(db);
    db.execSync(`pragma user_version = ${MIGRATIONS.length}`);
  });
}

let instance: SQLiteDatabase | undefined;
export function getDb() {
  if (!instance) {
    instance = openDatabaseSync('binku.db');
    instance.execSync('pragma journal_mode = WAL');
    migrate(instance);
  }
  return instance;
}

export function getKv(db: SQLiteDatabase, key: string) {
  return db.getFirstSync<{ value: string }>('select value from kv where key = ?', key)?.value;
}
export function setKv(db: SQLiteDatabase, key: string, value: string) {
  db.runSync('insert or replace into kv (key, value) values (?, ?)', key, value);
}
