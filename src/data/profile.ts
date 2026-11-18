// Local profile from onboarding (no account yet). DOB stays on the device until sign-up (M3),
// then it is uploaded and deleted here.
import type { SQLiteDatabase } from 'expo-sqlite';

import { dataVersion } from '@/data/catalog';
import { getKv, setKv } from '@/data/db';

export type LocalProfile = {
  country: string;
  subdivision: string;
  dob: string;
  isMinor: boolean;
  groups: string[];
  /** groupId → memberId, or 'all'. */
  bias: Record<string, string>;
};

export const isOnboarded = (db: SQLiteDatabase) => getKv(db, 'onboarding:done') === '1';

/** Country rules from the synced `country_config`; unknown countries get the strictest default. */
export function countryRules(db: SQLiteDatabase, country: string) {
  const row = db.getFirstSync<{ min_age: number; minor_limit: number }>(
    'select min_age, minor_limit from country_config where country = ?',
    country,
  );
  return { minAge: row?.min_age ?? 14, minorLimit: row?.minor_limit ?? 18 };
}

export function saveOnboarding(db: SQLiteDatabase, p: LocalProfile) {
  db.withTransactionSync(() => {
    setKv(db, 'profile', JSON.stringify(p));
    setKv(db, 'onboarding:done', '1');
  });
  dataVersion.bump();
}
