// Source of truth: docs/ai/04-design-system.md. Changing a value needs owner approval.

export const colors = {
  light: {
    bg: '#FBF8F3',
    surface: '#FFFFFF',
    surface2: '#F1ECE3',
    ink: '#141414',
    muted: '#5C5852',
    line: '#E3DDD2',
    accent: '#E5482D',
    accentText: '#C23A20',
    onInk: '#FFFFFF',
  },
  dark: {
    bg: '#121212',
    surface: '#1D1D1D',
    surface2: '#262626',
    ink: '#F6F2EA',
    muted: '#A7A29A',
    line: '#333131',
    accent: '#FF6A4D',
    accentText: '#FF6A4D',
    onInk: '#121212',
  },
} as const;

export type Colors = { [K in keyof typeof colors.light]: string };

export const era = {
  tomato: '#E5482D',
  cobalt: '#2D4BD8',
  mango: '#F2B230',
  mint: '#22A06B',
  bubblegum: '#EE5FA0',
} as const;

export type Era = keyof typeof era;

export const space = { 4: 4, 6: 6, 8: 8, 10: 10, 12: 12, 14: 14, 18: 18, 24: 24, 32: 32 } as const;
export const screenPadding = 18;

export const radius = { control: 14, card: 16, sheet: 28, chip: 999 } as const;

/** Photocard width:height. Corner radius ≈ 9 % of width. */
export const cardRatio = 55 / 85;
export const cardRadius = (width: number) => Math.round(width * 0.09);

export const fontSize = [46, 40, 34, 28, 22, 17, 15, 13, 12] as const;
export type FontSize = (typeof fontSize)[number];

export const fonts = {
  display800: 'BigShoulders-800',
  display900: 'BigShoulders-900',
  text400: 'InstrumentSans-400',
  text500: 'InstrumentSans-500',
  text600: 'InstrumentSans-600',
  text700: 'InstrumentSans-700',
  hangul: 'Pretendard-400',
} as const;

export const touchTarget = 48;
