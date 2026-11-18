// The user's marks (Tengo / Busco / Repetida) in the local DB; works without an account.
import type { SQLiteDatabase } from 'expo-sqlite';

import { dataVersion, type UserMark } from '@/data/catalog';

/** Sets or clears (null) the user's mark for a card. */
export function setMark(db: SQLiteDatabase, cardId: string, mark: UserMark | null) {
  if (!mark) {
    db.runSync('delete from user_cards where card_id = ?', cardId);
  } else {
    // shortcut: local id = card id (one row per card); the server assigns its own ids at sign-up (M3).
    db.runSync(
      `insert into user_cards (id, card_id, status, qty, updated_at) values (?1, ?1, ?2, ?3, ?4)
       on conflict (card_id) do update set status = ?2, qty = ?3, updated_at = ?4`,
      cardId,
      mark.status,
      Math.max(1, Math.round(mark.qty)),
      new Date().toISOString(),
    );
  }
  dataVersion.bump();
}
