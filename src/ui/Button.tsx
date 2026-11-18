import { Pressable, View, type PressableProps, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Icon, type IconName } from './icons/Icon';
import { Txt } from './Txt';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  /** `accent` is reserved for scanning. */
  variant?: 'primary' | 'accent' | 'ghost' | 'danger';
  compact?: boolean;
  /** Leading icon (18 px), decorative. */
  icon?: IconName;
  style?: ViewStyle;
};

export function Button({
  label,
  variant = 'primary',
  compact,
  icon,
  style,
  disabled,
  ...rest
}: Props) {
  const c = useTheme();
  const look = {
    primary: { bg: c.ink, fg: c.onInk, border: c.ink },
    accent: { bg: c.accent, fg: colors.light.ink, border: c.accent }, // text on accent is always dark ink (contrast)
    ghost: { bg: 'transparent', fg: c.ink, border: c.ink },
    danger: { bg: 'transparent', fg: c.accentText, border: c.accentText },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={compact ? 4 : 0}
      style={({ pressed }) => [
        {
          minHeight: compact ? 40 : 50,
          paddingHorizontal: compact ? 14 : 18,
          paddingVertical: 8,
          borderRadius: radius.control,
          borderWidth: 1.5,
          borderColor: look.border,
          backgroundColor: look.bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon ? <Icon name={icon} size={18} color={look.fg} strokeWidth={2} /> : null}
        <Txt
          variant="label"
          size={compact ? 13 : 15}
          color={look.fg}
          style={{ textAlign: 'center', flexShrink: 1 }}
        >
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}
