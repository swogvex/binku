import { View } from 'react-native';

import { textOn } from '@/lib/contrast';
import { era, type Era } from '@/theme/tokens';

import { Icon, type IconName } from './icons/Icon';
import { Txt } from './Txt';

type Props = { icon: IconName; tint: Era; title: string; body?: string };

/**
 * Centred top of a set-up step (onboarding, account): an era-coloured tile with the step's
 * icon — the app-icon motif — then the headline and one calm line of context.
 */
export function StepHeader({ icon, tint, title, body }: Props) {
  const bg = era[tint];
  return (
    <View style={{ alignItems: 'center', gap: 14 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '-4deg' }],
        }}
      >
        <Icon name={icon} size={30} color={textOn(bg)} strokeWidth={2} />
      </View>
      <Txt variant="display" size={40} accessibilityRole="header" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      {body ? (
        <Txt size={17} muted style={{ textAlign: 'center', maxWidth: 340 }}>
          {body}
        </Txt>
      ) : null}
    </View>
  );
}
