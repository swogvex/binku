// The user's marks (Tengo / Busco / Repetida) in the local DB; works without an account.
import type { SQLiteDatabase } from 'expo-sqlite';

import { dataVersion, type UserMark } from '@/data/catalog';
import { enqueue } from '@/data/outbox';

/** Sets or clears (null) the user's mark for a card. */
export function setMark(db: SQLiteDatabase, cardId: string, mark: UserMark | null) {
  if (!mark) {
    db.runSync('delete from user_cards where card_id = ?', cardId);
  } else {
    // Local id = card id: one row per card, like the server's (user_id, card_id) key.
    // Offers belong to spares; a price only to sale offers (the server checks both too).
    const offer = mark.status === 'dupe' ? (mark.offer ?? null) : null;
    db.runSync(
      `insert into user_cards (id, card_id, status, qty, updated_at, offer, price_cents)
       values (?1, ?1, ?2, ?3, ?4, ?5, ?6)
       on conflict (card_id) do update set status = ?2, qty = ?3, updated_at = ?4, offer = ?5,
         price_cents = ?6`,
      cardId,
      mark.status,
      Math.max(1, Math.round(mark.qty)),
      new Date().toISOString(),
      offer,
      offer && offer !== 'trade' ? (mark.priceCents ?? null) : null,
    );
  }
  enqueue(db, 'mark', cardId);
  dataVersion.bump();
}
