import { View } from 'react-native';

import { t } from '@/i18n';
import { cardRadius, cardRatio, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Button } from './Button';
import { Icon, type IconName } from './icons/Icon';
import { Txt } from './Txt';

type Action = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  icon?: IconName;
};

type Props = {
  illustration: 'pocket' | 'ups' | 'camera';
  title: string;
  body?: string;
  actions?: Action[];
  /** Error code shown small under the actions. */
  code?: string;
};

function Illustration({ kind }: { kind: Props['illustration'] }) {
  const c = useTheme();
  if (kind === 'camera') {
    return (
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.card,
          backgroundColor: c.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="camera" size={36} />
      </View>
    );
  }
  const w = 76;
  return (
    <View
      style={{
        width: w,
        aspectRatio: cardRatio,
        borderRadius: cardRadius(w),
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: c.muted,
        backgroundColor: c.surface2,
        alignItems: 'center',
        justifyContent: 'center',
        transform: kind === 'ups' ? [{ rotate: '-8deg' }] : undefined,
      }}
    >
      {kind === 'ups' ? (
        <Txt variant="display" size={22}>
          {t('states.error.badge')}
        </Txt>
      ) : null}
    </View>
  );
}

/** Empty, error, permission-denied and no-results states share this binder-styled layout. */
export function StateView({ illustration, title, body, actions = [], code }: Props) {
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32, gap: 14 }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Illustration kind={illustration} />
      </View>
      <Txt variant="display" size={28} accessibilityRole="header" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      {body ? (
        <Txt muted style={{ textAlign: 'center' }}>
          {body}
        </Txt>
      ) : null}
      {actions.length > 0 ? (
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 4 }}>
          {actions.map((a) => (
            <Button
              key={a.label}
              label={a.label}
              variant={a.variant}
              icon={a.icon}
              onPress={a.onPress}
            />
          ))}
        </View>
      ) : null}
      {code ? (
        <Txt variant="body" size={12} muted>
          {t('states.error.code', { code })}
        </Txt>
      ) : null}
    </View>
  );
}
