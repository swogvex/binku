import { View } from 'react-native';

import { t } from '@/i18n';
import { colors, era } from '@/theme/tokens';

import { Txt } from './Txt';

/** Mango banner on top of normal content while offline. */
export function OfflineBanner({ pendingPhotos = 0 }: { pendingPhotos?: number }) {
  const text = [
    t('states.offline.title'),
    pendingPhotos > 0 ? t('states.offline.pending', { count: pendingPhotos }) : '',
  ].join(' ');
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ backgroundColor: era.mango, paddingHorizontal: 18, paddingVertical: 10 }}
    >
      <Txt variant="label" color={colors.light.ink}>
        {text.trim()}
      </Txt>
    </View>
  );
}
