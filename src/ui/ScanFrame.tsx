import { Image, type ImageProps } from 'expo-image';
import { View } from 'react-native';

import { t } from '@/i18n';
import { cardRadius, cardRatio } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Holo } from './Holo';

type Props = { source: ImageProps['source']; member: string; width?: number; holo?: boolean };

/** The user's photo inside a 3 px ink frame. Frame is drawn, never baked into the image file. */
export function ScanFrame({ source, member, width = 110, holo = false }: Props) {
  const c = useTheme();
  return (
    <View
      style={{
        width,
        aspectRatio: cardRatio,
        borderRadius: cardRadius(width),
        borderWidth: 3,
        borderColor: c.ink,
        overflow: 'hidden',
        backgroundColor: c.surface2,
      }}
    >
      <Image
        source={source}
        style={{ flex: 1 }}
        contentFit="cover"
        accessible
        accessibilityLabel={t('card.photoOf', { member })}
      />
      {holo ? <Holo width={width} /> : null}
    </View>
  );
}
