import { Platform, Text, type TextProps, type TextStyle } from 'react-native';

import { fonts, type FontSize } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const variants = {
  display: { fontFamily: fonts.display900, textTransform: 'uppercase', lh: 0.95 },
  title: { fontFamily: fonts.text700, lh: 1.35 },
  body: { fontFamily: fonts.text400, lh: 1.35 },
  label: { fontFamily: fonts.text600, lh: 1.35 },
} as const;

const defaultSize: Record<keyof typeof variants, FontSize> = {
  display: 34,
  title: 17,
  body: 15,
  label: 13,
};

type Props = TextProps & {
  variant?: keyof typeof variants;
  size?: FontSize;
  /** Explicit colour; defaults to ink, or muted with `muted`. */
  color?: string;
  muted?: boolean;
};

export function Txt({ variant = 'body', size, color, muted, style, ...rest }: Props) {
  const c = useTheme();
  const { lh, ...v } = variants[variant];
  const fontSize = size ?? defaultSize[variant];
  const base: TextStyle = {
    ...v,
    fontSize,
    lineHeight: Math.round(fontSize * lh),
    color: color ?? (muted ? c.muted : c.ink),
    // Android adds extra top padding to custom fonts; removing it keeps display type tight.
    ...(Platform.OS === 'android' && { includeFontPadding: false }),
    // Tight display lines (0.95) would clip accents on capitals (Á, Ó) and the tail of "¿":
    // a little padding keeps every glyph inside the text box on both platforms.
    ...(variant === 'display' && {
      paddingTop: Math.ceil(fontSize * 0.16),
      paddingBottom: Math.ceil(fontSize * 0.12),
    }),
  };
  return <Text style={[base, style]} {...rest} />;
}
