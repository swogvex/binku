import { Pressable } from 'react-native';

import { haptics } from '@/lib/haptics';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Txt } from './Txt';

type Props = { label: string; selected?: boolean; onPress?: () => void };

export function Chip({ label, selected = false, onPress }: Props) {
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
        justifyContent: 'center',
        borderRadius: radius.chip,
        borderWidth: 1.5,
        borderColor: selected ? c.ink : c.line,
        backgroundColor: selected ? c.ink : c.surface,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Txt variant="label" color={selected ? c.onInk : c.ink}>
        {label}
      </Txt>
    </Pressable>
  );
}
