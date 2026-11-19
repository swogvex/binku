import { Pressable, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Txt } from './Txt';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Leading colour dot (a group's or binder's era colour). */
  dot?: string;
};

export function Chip({ label, selected = false, onPress, dot }: Props) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={6} // 36 px chip → 48 dp touch target
      onPress={() => {
        haptics.selection();
        onPress?.();
      }}
      style={({ pressed }) => ({
        minHeight: 36,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: radius.chip,
        borderWidth: 1.5,
        borderColor: selected ? c.ink : c.line,
        backgroundColor: selected ? c.ink : c.surface,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {dot ? (
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: dot,
            borderWidth: 1.5,
            borderColor: selected ? c.onInk : c.surface,
          }}
        />
      ) : null}
      <Txt variant="label" color={selected ? c.onInk : c.ink}>
        {label}
      </Txt>
    </Pressable>
  );
}
