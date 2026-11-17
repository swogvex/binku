import { contrastRatio, textOn } from '@/lib/contrast';
import { era } from '@/theme/tokens';

test('matches known WCAG ratios', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  expect(contrastRatio('#E5482D', '#FFFFFF')).toBeCloseTo(3.96, 1); // why text on accent is never white
});

test('every era colour gets a text colour with at least 4.5:1', () => {
  for (const bg of Object.values(era))
    expect(contrastRatio(bg, textOn(bg))).toBeGreaterThanOrEqual(4.5);
});
