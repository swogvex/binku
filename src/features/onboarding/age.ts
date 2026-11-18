// Date-of-birth checks for the age gate (pure, tested).

export type Dob = { day: number; month: number; year: number };

/** Parses day/month/year fields; null if it is not a real past date within 120 years. */
export function parseDob(day: string, month: string, year: string, today = new Date()): Dob | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (![d, m, y].every(Number.isInteger) || year.length !== 4) return null;
  const date = new Date(y, m - 1, d);
  const real = date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  if (!real || date > today || today.getFullYear() - y > 120) return null;
  return { day: d, month: m, year: y };
}

/** Completed years on `today`. */
export function ageOn(dob: Dob, today = new Date()) {
  const hadBirthday =
    today.getMonth() + 1 > dob.month ||
    (today.getMonth() + 1 === dob.month && today.getDate() >= dob.day);
  return today.getFullYear() - dob.year - (hadBirthday ? 0 : 1);
}

export const isoDate = (dob: Dob) =>
  `${dob.year}-${String(dob.month).padStart(2, '0')}-${String(dob.day).padStart(2, '0')}`;
