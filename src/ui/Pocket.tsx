import type { ReactNode } from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { cardRadius, cardRatio } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Txt } from './Txt';

type Props = {
  member: string;
  /** Which card goes here (version, POB, lucky draw…), so empty pockets are told apart. */
  detail?: string;
  width?: number;
  /** A ScanFrame or CardMarker of the same width; empty pocket when omitted. */
  children?: ReactNode;
};

export function Pocket({ member, detail, width = 110, children }: Props) {
  const c = useTheme();
  if (children) return <View style={{ width }}>{children}</View>;
  return (
    <View
      accessible
      accessibilityLabel={[t('pocket.a11yEmpty', { member }), detail].filter(Boolean).join(', ')}
      style={{
        width,
        aspectRatio: cardRatio,
        borderRadius: cardRadius(width),
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: c.muted,
        backgroundColor: c.surface2,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
      }}
    >
      <Txt variant="display" size={17} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {member}
      </Txt>
      {detail ? (
        <Txt variant="label" size={12} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {detail}
        </Txt>
      ) : null}
      <Txt variant="body" size={12} muted numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {t('pocket.missing')}
      </Txt>
    </View>
  );
}
