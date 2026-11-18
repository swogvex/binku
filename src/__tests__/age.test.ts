import { ageOn, isoDate, parseDob } from '@/features/onboarding/age';

const today = new Date(2026, 10, 18); // 18 Nov 2026

describe('age gate', () => {
  it('parses only real past dates', () => {
    expect(parseDob('14', '3', '2011', today)).toEqual({ day: 14, month: 3, year: 2011 });
    expect(parseDob('31', '2', '2011', today)).toBeNull();
    expect(parseDob('1', '1', '2030', today)).toBeNull();
    expect(parseDob('1', '1', '11', today)).toBeNull();
    expect(parseDob('', '1', '2011', today)).toBeNull();
    expect(parseDob('1', '1', '1890', today)).toBeNull();
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
