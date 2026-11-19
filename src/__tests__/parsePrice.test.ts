jest.mock('@/i18n', () => ({ locale: 'es', t: (k: string) => k }));

import { parsePrice } from '@/features/card/OfferSection';

test('reads prices with comma or dot, in cents', () => {
  expect(parsePrice('5,5')).toBe(550);
  expect(parsePrice(' 12.99 ')).toBe(1299);
  expect(parsePrice('0')).toBe(0);
  expect(parsePrice('')).toBeNull();
});

test('ignores junk instead of guessing', () => {
  expect(parsePrice('5,555')).toBeUndefined();
  expect(parsePrice('-3')).toBeUndefined();
  expect(parsePrice('1e3')).toBeUndefined();
  expect(parsePrice('1234567')).toBeUndefined();
});
