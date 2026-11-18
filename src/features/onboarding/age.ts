// Date-of-birth checks for the age gate (pure, tested).

export type Dob = { day: number; month: number; year: number };

export const fromDate = (d: Date): Dob => ({
  day: d.getDate(),
  month: d.getMonth() + 1,
  year: d.getFullYear(),
});

/** Completed years on `today`. */
export function ageOn(dob: Dob, today = new Date()) {
  const hadBirthday =
    today.getMonth() + 1 > dob.month ||
    (today.getMonth() + 1 === dob.month && today.getDate() >= dob.day);
  return today.getFullYear() - dob.year - (hadBirthday ? 0 : 1);
}

export const isoDate = (dob: Dob) =>
  `${dob.year}-${String(dob.month).padStart(2, '0')}-${String(dob.day).padStart(2, '0')}`;
