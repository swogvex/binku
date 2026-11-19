// Write queue towards the account. Only queues once this device is linked to an account
// (kv `sync:user`); before that the binder is local-only and is uploaded in one go at sign-up.
import type { SQLiteDatabase } from 'expo-sqlite';

import { getKv } from '@/data/db';

export type Entity = 'binder' | 'slots' | 'mark' | 'photo';

/**
 * Server rejections that can never succeed on retry (bad value, constraint, RLS): drop and report.
 * Everything else (offline, expired token, missing function after a bad deploy) is retried.
 */
export const isPermanent = (code: string | undefined) => /^(22|23)|^42501$/.test(code ?? '');

let onQueued: (() => void) | undefined;
/** The sync engine registers here to upload soon after a change. */
export const setQueueListener = (fn: () => void) => void (onQueued = fn);

export function enqueue(db: SQLiteDatabase, entity: Entity, key: string) {
  if (!getKv(db, 'sync:user')) return;
  db.runSync(
    `insert into outbox (entity, key, created_at) values (?, ?, ?)
     on conflict (entity, key) do update set version = version + 1, attempts = 0, next_try = 0`,
    entity,
    key,
    Date.now(),
  );
  onQueued?.();
}
