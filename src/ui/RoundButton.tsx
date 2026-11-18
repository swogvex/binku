import { Pressable } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { Icon, type IconName } from '@/ui/icons/Icon';

/** 44 pt round icon button (back, share…) on screens without a native header. */
export function RoundButton(props: { icon: IconName; label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        opacity: pressed ? 0.7 : 1,
      })}
      hitSlop={4}
    >
      <Icon name={props.icon} size={20} />
    </Pressable>
  );
}
