// The user's binders in the local DB (no account needed). Edits bump `dataVersion`.
import type { SQLiteDatabase } from 'expo-sqlite';

import { dataVersion } from '@/data/catalog';
import { enqueue } from '@/data/outbox';
import type { Path } from '@/features/catalog/filter';
import { uuid } from '@/lib/uuid';

export type BinderKind = 'group' | 'member' | 'era' | 'custom';
export type Layout = '3x3' | '2x2';
export type Binder = {
  id: string;
  title: string;
  kind: BinderKind;
  filter: Path;
  layout: Layout;
};

const now = () => new Date().toISOString();

export function listBinders(db: SQLiteDatabase): Binder[] {
  return db
    .getAllSync<Omit<Binder, 'filter'> & { filter: string | null }>(
      'select id, title, kind, filter, layout from binders order by sort, updated_at',
    )
    .map((b) => ({ ...b, filter: b.filter ? (JSON.parse(b.filter) as Path) : {} }));
}

export function createBinder(db: SQLiteDatabase, b: Omit<Binder, 'id' | 'layout'>) {
  // Same id on the server: created offline, uploaded later.
  const id = uuid();
  const sort =
    db.getFirstSync<{ n: number }>('select coalesce(max(sort), -1) + 1 n from binders')?.n ?? 0;
  db.runSync(
    'insert into binders (id, title, kind, filter, layout, sort, updated_at) values (?, ?, ?, ?, ?, ?, ?)',
    id,
    b.title,
    b.kind,
    JSON.stringify(b.filter),
    '3x3',
    sort,
    now(),
  );
  enqueue(db, 'binder', id);
  dataVersion.bump();
  return id;
}

export function updateBinder(
  db: SQLiteDatabase,
  id: string,
  p: { title?: string; layout?: Layout },
) {
  db.runSync(
    'update binders set title = coalesce(?, title), layout = coalesce(?, layout), updated_at = ? where id = ?',
    p.title ?? null,
    p.layout ?? null,
    now(),
    id,
  );
  enqueue(db, 'binder', id);
  dataVersion.bump();
}

export function deleteBinder(db: SQLiteDatabase, id: string) {
  db.withTransactionSync(() => {
    db.runSync('delete from binder_slots where binder_id = ?', id);
    db.runSync('delete from binders where id = ?', id);
    enqueue(db, 'binder', id);
  });
  dataVersion.bump();
}

/** Saved card order (flat; pages are derived from the layout, so 3×3 ↔ 2×2 keeps it). */
export function loadOrder(db: SQLiteDatabase, binderId: string): string[] {
  return db
    .getAllSync<{ card_id: string }>(
      'select card_id from binder_slots where binder_id = ? order by position',
      binderId,
    )
    .map((r) => r.card_id);
}

export function saveOrder(db: SQLiteDatabase, binderId: string, cardIds: string[]) {
  db.withTransactionSync(() => {
    db.runSync('delete from binder_slots where binder_id = ?', binderId);
    cardIds.forEach((cardId, i) =>
      // `page` stays 0: position is the flat index (see loadOrder).
      db.runSync(
        'insert into binder_slots (id, binder_id, page, position, card_id) values (?, ?, 0, ?, ?)',
        `${binderId}:${cardId}`,
        binderId,
        i,
        cardId,
      ),
    );
    enqueue(db, 'slots', binderId);
  });
  dataVersion.bump();
}
