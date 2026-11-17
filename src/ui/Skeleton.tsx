import { useEffect } from 'react';
import type { DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';

type Props = {
  width: DimensionValue;
  height?: DimensionValue;
  aspectRatio?: number;
  radius?: number;
};

/** Placeholder block in the real layout while data loads (no spinners). */
export function Skeleton({ width, height, aspectRatio, radius = 8 }: Props) {
  const c = useTheme();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!reduced) opacity.value = withRepeat(withTiming(0.5, { duration: 800 }), -1, true);
  }, [reduced, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityLabel={t('states.loading')}
      accessibilityRole="progressbar"
      style={[
        { width, height, aspectRatio, borderRadius: radius, backgroundColor: c.surface2 },
        style,
      ]}
    />
  );
}
