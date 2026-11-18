// Account sync (09-offline-sync.md): upload the outbox in order, then pull what changed on the
// server since the last cursor. Last write wins per binder / card (server timestamp); a pull never
// overwrites something that still has a pending local edit.
import * as Sentry from '@sentry/react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { AppState } from 'react-native';

import { loadOrder } from '@/data/binders';
import { dataVersion } from '@/data/catalog';
import { getDb, getKv, setKv } from '@/data/db';
import { enqueue, isPermanent, setQueueListener, type Entity } from '@/data/outbox';
import { supabase } from '@/lib/supabase';
import { isUuid, uuid } from '@/lib/uuid';

const MAX_ATTEMPTS = 6; // then it waits for "Reintentar" in Settings
const PAGE = 500;
const EPOCH = '1970-01-01T00:00:00Z';

type QueueRow = { entity: Entity; key: string; version: number; attempts: number };
type PgError = { code?: string; message?: string } | null;
type ServerBinder = {
  id: string;
  title: string;
  kind: string;
  filter: unknown;
  layout: string;
  sort: number;
  updated_at: string;
  deleted_at: string | null;
};
type ServerMark = {
  card_id: string;
  status: string;
  qty: number;
  updated_at: string;
  deleted_at: string | null;
};

const now = () => new Date().toISOString();
const pending = (db: SQLiteDatabase, entity: Entity, key: string) =>
  !!db.getFirstSync('select 1 from outbox where entity = ? and key = ?', entity, key);

/** Only sync while the signed-in user is the account this device's data belongs to. */
async function linkedUser(db: SQLiteDatabase) {
  const linked = getKv(db, 'sync:user');
  const { data } = await supabase.auth.getSession();
  return linked && data.session?.user.id === linked ? linked : null;
}

async function push(db: SQLiteDatabase, r: QueueRow): Promise<PgError> {
  if (r.entity === 'mark') {
    const m = db.getFirstSync<{ status: string; qty: number }>(
      'select status, qty from user_cards where card_id = ?',
      r.key,
    );
    const res = m
      ? await supabase
          .from('user_cards')
          .upsert(
            { card_id: r.key, status: m.status, qty: m.qty, deleted_at: null },
            { onConflict: 'user_id,card_id' },
          )
      : await supabase.from('user_cards').update({ deleted_at: now() }).eq('card_id', r.key);
    return res.error;
  }
  if (!isUuid(r.key)) return null; // pre-account id: linkAccount re-keys before queueing
  if (r.entity === 'binder') {
    const b = db.getFirstSync<{
      title: string;
      kind: string;
      filter: string | null;
      layout: string;
      sort: number;
    }>('select title, kind, filter, layout, sort from binders where id = ?', r.key);
    const res = b
      ? await supabase.from('binders').upsert({
          id: r.key,
          ...b,
          filter: b.filter ? JSON.parse(b.filter) : null,
          deleted_at: null,
        })
      : await supabase.from('binders').update({ deleted_at: now() }).eq('id', r.key);
    return res.error;
  }
  if (!db.getFirstSync('select 1 from binders where id = ?', r.key)) return null; // binder gone
  const res = await supabase.rpc('set_binder_slots', {
    p_binder: r.key,
    p_cards: loadOrder(db, r.key),
  });
  return res.error;
}

async function doFlush(db: SQLiteDatabase) {
  if (!(await linkedUser(db))) return;
  const rows = db.getAllSync<QueueRow>(
    `select entity, key, version, attempts from outbox where next_try <= ? and attempts < ?
     order by case entity when 'binder' then 0 when 'slots' then 1 else 2 end, created_at`,
    Date.now(),
    MAX_ATTEMPTS,
  );
  for (const r of rows) {
    const error = await push(db, r);
    if (error && !isPermanent(error.code)) {
      // No code = no answer from the server (offline): try again later without counting it.
      if (error.code) {
        const attempts = r.attempts + 1;
        db.runSync(
          'update outbox set attempts = ?, next_try = ?, last_error = ? where entity = ? and key = ? and version = ?',
          attempts,
          Date.now() + 5000 * 2 ** attempts,
          error.message ?? error.code,
          r.entity,
          r.key,
          r.version,
        );
      }
      return; // keep the order: slots wait for their binder
    }
    // Error code only: ids and card names stay out of Sentry.
    if (error) Sentry.captureMessage(`sync: ${r.entity} rejected (${error.code})`);
    db.runSync(
      'delete from outbox where entity = ? and key = ? and version = ?',
      r.entity,
      r.key,
      r.version,
    );
  }
}

let flushing: Promise<void> | undefined;
export function flush(db = getDb()) {
  return (flushing ??= doFlush(db).finally(() => (flushing = undefined)));
}

/** Rows changed after the cursor, keyset-paged on (updated_at, key): bulk writes share one timestamp. */
async function pullChanged<T extends { updated_at: string }>(
  db: SQLiteDatabase,
  table: 'binders' | 'user_cards',
  key: 'id' | 'card_id',
  apply: (rows: T[]) => Promise<() => void>,
) {
  const cursorKey = `sync:cursor:${table}`;
  let cur = JSON.parse(getKv(db, cursorKey) ?? 'null') ?? { t: EPOCH, k: '' };
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .or(`updated_at.gt."${cur.t}",and(updated_at.eq."${cur.t}",${key}.gt."${cur.k}")`)
      .order('updated_at')
      .order(key)
      .limit(PAGE);
    if (error) throw error;
    const rows = data as unknown as T[];
    if (!rows.length) return;
    const write = await apply(rows); // network first, then one local transaction
    const last = rows[rows.length - 1] as T & Record<string, string>;
    cur = { t: last.updated_at, k: last[key] };
    db.withTransactionSync(() => {
      write();
      setKv(db, cursorKey, JSON.stringify(cur));
    });
    dataVersion.bump();
    if (rows.length < PAGE) return;
  }
}

async function slotsOf(binderId: string) {
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('binder_slots')
      .select('card_id')
      .eq('binder_id', binderId)
      .order('page')
      .order('position')
      .range(from, from + 999);
    if (error) throw error;
    ids.push(...data.map((r) => r.card_id as string));
    if (data.length < 1000) return ids;
  }
}

async function pull(db: SQLiteDatabase) {
  await pullChanged<ServerBinder>(db, 'binders', 'id', async (rows) => {
    const fresh = rows.filter((b) => !pending(db, 'binder', b.id) && !pending(db, 'slots', b.id));
    const slots = new Map<string, string[]>();
    for (const b of fresh) if (!b.deleted_at) slots.set(b.id, await slotsOf(b.id));
    return () => {
      for (const b of fresh) {
        db.runSync('delete from binder_slots where binder_id = ?', b.id);
        if (b.deleted_at) {
          db.runSync('delete from binders where id = ?', b.id);
          continue;
        }
        db.runSync(
          'insert or replace into binders (id, title, kind, filter, layout, sort, updated_at) values (?, ?, ?, ?, ?, ?, ?)',
          b.id,
          b.title,
          b.kind,
          b.filter == null ? null : JSON.stringify(b.filter),
          b.layout,
          b.sort,
          b.updated_at,
        );
        slots
          .get(b.id)!
          .forEach((cardId, i) =>
            db.runSync(
              'insert or replace into binder_slots (id, binder_id, page, position, card_id) values (?, ?, 0, ?, ?)',
              `${b.id}:${cardId}`,
              b.id,
              i,
              cardId,
            ),
          );
      }
    };
  });
  await pullChanged<ServerMark>(db, 'user_cards', 'card_id', async (rows) => () => {
    for (const m of rows) {
      if (pending(db, 'mark', m.card_id)) continue;
      if (m.deleted_at) db.runSync('delete from user_cards where card_id = ?', m.card_id);
      else
        db.runSync(
          `insert into user_cards (id, card_id, status, qty, updated_at) values (?1, ?1, ?2, ?3, ?4)
           on conflict (card_id) do update set status = ?2, qty = ?3, updated_at = ?4`,
          m.card_id,
          m.status,
          m.qty,
          m.updated_at,
        );
    }
  });
}

/** Upload pending changes, then download the others. Safe to call any time. */
export async function sync(db = getDb()) {
  await flush(db);
  if (await linkedUser(db)) await pull(db);
}

const report = (e: unknown) => {
  // Offline is normal; only server-side failures are worth a report.
  if (e instanceof TypeError || !(e as { code?: string })?.code) return;
  Sentry.captureMessage(`sync failed (${(e as { code: string }).code})`);
};

let started = false;
export function startSync() {
  if (started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  setQueueListener(() => {
    clearTimeout(timer);
    timer = setTimeout(() => flush().catch(report), 2000);
  });
  sync().catch(report);
  AppState.addEventListener('change', (s) => s === 'active' && sync().catch(report));
  setInterval(() => {
    if (AppState.currentState === 'active' && getDb().getFirstSync('select 1 from outbox'))
      flush().catch(report);
  }, 30_000);
}

export function localSummary(db: SQLiteDatabase) {
  const n = (sql: string) => db.getFirstSync<{ n: number }>(sql)?.n ?? 0;
  return {
    binders: n('select count(*) n from binders'),
    cards: n('select count(*) n from user_cards'),
  };
}

/**
 * Links this device to the account (idempotent). `upload` keeps the local binders and marks and
 * queues them all; `fresh` deletes them and takes the account's data.
 */
export async function linkAccount(db: SQLiteDatabase, userId: string, mode: 'upload' | 'fresh') {
  db.withTransactionSync(() => {
    db.execSync("delete from outbox; delete from kv where key like 'sync:%';");
    if (mode === 'fresh') {
      db.execSync('delete from binder_slots; delete from binders; delete from user_cards;');
    } else {
      // Binders made before M3 have local ids ("b-…"): give them server-valid uuids.
      for (const { id } of db.getAllSync<{ id: string }>('select id from binders')) {
        if (isUuid(id)) continue;
        const next = uuid();
        db.runSync('update binders set id = ? where id = ?', next, id);
        db.runSync(
          "update binder_slots set binder_id = ?1, id = ?1 || ':' || card_id where binder_id = ?2",
          next,
          id,
        );
        db.runSync("update kv set value = ? where key = 'binder:current' and value = ?", next, id);
      }
    }
    setKv(db, 'sync:user', userId);
    if (mode === 'upload') {
      for (const { id } of db.getAllSync<{ id: string }>('select id from binders')) {
        enqueue(db, 'binder', id);
        enqueue(db, 'slots', id);
      }
      for (const { card_id } of db.getAllSync<{ card_id: string }>(
        'select card_id from user_cards',
      ))
        enqueue(db, 'mark', card_id);
    }
  });
  dataVersion.bump();
  // Offline is fine: everything is queued and goes up on the next sync.
  await sync(db).catch(report);
}

/** Tries to upload what is pending, then unlinks. Local data stays on the device. */
export async function signOut(db = getDb()) {
  await flush(db).catch(report);
  db.execSync("delete from outbox; delete from kv where key like 'sync:%';");
  await supabase.auth.signOut();
}
