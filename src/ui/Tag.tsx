import { View } from 'react-native';

import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Txt } from './Txt';

type Props = { label: string; tone?: 'neutral' | 'strong' | 'outline' };

/** Small status pill (Doble, Enviado, Por valorar, De confianza…). */
export function Tag({ label, tone = 'neutral' }: Props) {
  const c = useTheme();
  const bg = { neutral: c.surface2, strong: c.ink, outline: 'transparent' }[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.chip,
        backgroundColor: bg,
        borderWidth: tone === 'outline' ? 1.5 : 0,
        borderColor: c.ink,
      }}
    >
      <Txt variant="label" size={12} color={tone === 'strong' ? c.onInk : c.ink}>
        {label}
      </Txt>
    </View>
  );
}
