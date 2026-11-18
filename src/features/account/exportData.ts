// "Exportar mis datos" (GDPR art. 15/20): everything the account holds, read from the server
// (the source of truth), as JSON (all personal data) or CSV (the collection, for spreadsheets).
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { loadCatalog } from '@/data/catalog';
import { toCsv } from '@/lib/csv';
import { supabase } from '@/lib/supabase';

/** Every row of the user's table, paged: the API returns at most 1,000 rows per request. */
async function rows<T>(table: string, ...orderBy: string[]) {
  const all: T[] = [];
  for (let from = 0; ; from += 1000) {
    // Ordered by the table's key so pages never repeat or skip rows.
    const query = orderBy.reduce((q, col) => q.order(col), supabase.from(table).select('*'));
    const { data, error } = await query.range(from, from + 999);
    if (error) throw error;
    all.push(...(data as T[]));
    if (data.length < 1000) return all;
  }
}

type Mark = {
  card_id: string;
  status: string;
  qty: number;
  updated_at: string;
  deleted_at: string | null;
};

async function collect() {
  const { data } = await supabase.auth.getSession();
  const user = data.session!.user;
  const [profile, binders, slots, marks] = await Promise.all([
    rows<Record<string, unknown>>('profiles', 'id'),
    rows<Record<string, unknown> & { id: string; deleted_at: string | null }>('binders', 'id'),
    rows<{ binder_id: string; page: number; position: number; card_id: string }>(
      'binder_slots',
      'binder_id',
      'page',
      'position',
    ),
    rows<Mark>('user_cards', 'card_id'),
  ]);
  return {
    user,
    profile: profile[0],
    binders: binders.filter((b) => !b.deleted_at),
    slots,
    marks: marks.filter((m) => !m.deleted_at),
  };
}

async function share(name: string, content: string, mimeType: string) {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** All personal data the account holds. */
export async function exportJson() {
  const d = await collect();
  const json = {
    exported_at: new Date().toISOString(),
    account: { id: d.user.id, email: d.user.email, created_at: d.user.created_at },
    profile: d.profile,
    binders: d.binders.map((b) => ({
      ...b,
      cards: d.slots
        .filter((s) => s.binder_id === b.id)
        .sort((a, z) => a.page - z.page || a.position - z.position)
        .map((s) => s.card_id),
    })),
    marks: d.marks,
  };
  await share(`binku-${stamp()}.json`, JSON.stringify(json, null, 2), 'application/json');
}

/** The collection (Tengo / Busco / Repetida) with readable card names. */
export async function exportCsv(db: SQLiteDatabase) {
  const { marks } = await collect();
  const cards = new Map(loadCatalog(db).map((c) => [c.id, c]));
  const header = ['group', 'member', 'album', 'version', 'type', 'status', 'copies', 'card_id'];
  const body = marks.map((m) => {
    const c = cards.get(m.card_id);
    return [
      c?.groupName,
      c?.memberName,
      c?.releaseTitle,
      c?.versionLabel,
      c?.type,
      m.status,
      m.qty,
      m.card_id,
    ];
  });
  await share(`binku-${stamp()}.csv`, toCsv([header, ...body]), 'text/csv');
}
