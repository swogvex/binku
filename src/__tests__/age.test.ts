import { ageOn, fromDate, isoDate } from '@/features/onboarding/age';

const today = new Date(2026, 10, 18); // 18 Nov 2026

describe('age gate', () => {
  it('converts picker dates', () => {
    expect(fromDate(new Date(2011, 2, 14))).toEqual({ day: 14, month: 3, year: 2011 });
  });

  it('counts completed years around the birthday', () => {
    expect(ageOn({ day: 18, month: 11, year: 2012 }, today)).toBe(14);
    expect(ageOn({ day: 19, month: 11, year: 2012 }, today)).toBe(13);
    expect(ageOn({ day: 1, month: 1, year: 2008 }, today)).toBe(18);
  });

  it('formats ISO dates', () => {
    expect(isoDate({ day: 4, month: 3, year: 2011 })).toBe('2011-03-04');
  });
});
