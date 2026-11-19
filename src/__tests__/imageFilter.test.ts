import { isInappropriate, toInput } from '@/lib/imageFilter';

// hoisted by babel-jest above the import
jest.mock('@sentry/react-native', () => ({}));
jest.mock('expo-image-manipulator', () => ({}));

// classes: drawings, hentai, neutral, porn, sexy
const s = (...v: number[]) => new Float32Array(v);

test('blocks porn or hentai above 0.7, never "sexy"', () => {
  expect(isInappropriate(s(0, 0, 0.1, 0.9, 0))).toBe(true);
  expect(isInappropriate(s(0, 0.8, 0.2, 0, 0))).toBe(true);
  expect(isInappropriate(s(0, 0, 0.05, 0, 0.95))).toBe(false);
  expect(isInappropriate(s(0.1, 0, 0.9, 0, 0))).toBe(false);
});

test('drops alpha and scales to 0..1', () => {
  const out = toInput(new Uint8Array([255, 0, 51, 255, 0, 255, 0, 7]));
  [1, 0, 0.2, 0, 1, 0].forEach((v, i) => expect(out[i]).toBeCloseTo(v));
  expect(out).toHaveLength(6);
});
