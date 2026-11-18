// Catalog read model for screens: one joined row per approved card, plus the user's marks.
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Era } from '@/theme/tokens';

import type { CardType } from './catalogFile';

export type CatalogCard = {
  id: string;
  groupId: string;
  groupName: string;
  memberId: string;
  memberName: string;
  memberNameKo: string | null;
  releaseId: string;
  releaseTitle: string;
  versionId: string | null;
  versionLabel: string | null;
  type: CardType;
  store: string | null;
  year: number;
  isSpecial: boolean;
  eraColor: Era;
};

export type UserMark = { status: 'have' | 'want' | 'dupe'; qty: number };

export function loadCatalog(db: SQLiteDatabase): CatalogCard[] {
  return db
    .getAllSync<Omit<CatalogCard, 'isSpecial'> & { isSpecial: number }>(
      `select c.id, c.group_id groupId, g.name groupName, c.member_id memberId, m.name memberName,
              m.name_ko memberNameKo, c.release_id releaseId, r.title releaseTitle,
              c.version_id versionId, v.label versionLabel, c.type, c.store, c.year,
              c.is_special isSpecial, r.era_color eraColor
         from cards c
         join groups g on g.id = c.group_id and g.status = 'approved'
         join members m on m.id = c.member_id and m.status = 'approved'
         join releases r on r.id = c.release_id and r.status = 'approved'
         left join versions v on v.id = c.version_id
        where c.status = 'approved'
        order by g.name, r.year desc, r.title, v.label, m.name, c.type, c.store`,
    )
    .map((r) => ({ ...r, isSpecial: r.isSpecial === 1 }));
}

export function loadMarks(db: SQLiteDatabase): Map<string, UserMark> {
  const rows = db.getAllSync<UserMark & { card_id: string }>(
    'select card_id, status, qty from user_cards',
  );
  return new Map(rows.map((r) => [r.card_id, { status: r.status, qty: r.qty }]));
}

// Screens re-read when the catalog or the user's marks change.
let version = 0;
const listeners = new Set<() => void>();
export const dataVersion = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: () => version,
  bump() {
    version++;
    listeners.forEach((fn) => fn());
  },
};
