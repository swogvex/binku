import { cardCrop } from '@/data/photos';

// Native modules are not needed by the pure crop maths (jest hoists these mocks).
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('@/lib/supabase', () => ({}));
jest.mock('@/lib/imageFilter', () => ({}));

test('a wide scan keeps its full height and loses the sides', () => {
  expect(cardCrop(1000, 1000)).toEqual({ originX: 177, originY: 0, width: 647, height: 1000 });
});

test('a tall scan keeps its full width and loses top and bottom', () => {
  expect(cardCrop(550, 1000)).toEqual({ originX: 0, originY: 75, width: 550, height: 850 });
});

test('an exact 55:85 scan is untouched', () => {
  expect(cardCrop(550, 850)).toEqual({ originX: 0, originY: 0, width: 550, height: 850 });
});
