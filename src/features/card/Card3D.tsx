// Card you can turn with a finger in every direction; a tap flips it. On release it settles on
// the nearest face. The holo shine follows both the finger and the phone tilt.
import type { ReactNode } from 'react';
import {
  GestureDetector,
  useExclusiveGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';

import { settleAngle } from './settle';

const MAX_TILT = 35;

type Props = {
  width: number;
  label: string;
  front: (rotate: { x: SharedValue<number>; y: SharedValue<number> }) => ReactNode;
  back: ReactNode;
};

export function Card3D({ width, label, front, back }: Props) {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startY = useSharedValue(0);
  const settle = (to: number) => {
    'worklet';
    return reduced
      ? withTiming(to, { duration: 0 })
      : withSpring(to, { damping: 18, stiffness: 140 });
  };

  const pan = usePanGesture({
    onActivate: () => {
      'worklet';
      startY.set(y.get());
    },
    onUpdate: (e) => {
      'worklet';
      y.set(startY.get() + e.translationX * 0.6);
      x.set(Math.max(-MAX_TILT, Math.min(MAX_TILT, -e.translationY * 0.4)));
    },
    onDeactivate: (e) => {
      'worklet';
      y.set(settle(settleAngle(y.get(), e.velocityX * 0.6)));
      x.set(settle(0));
    },
  });
  const flip = () => {
    'worklet';
    y.set(settle(settleAngle(y.get(), 0) + 180));
    scheduleOnRN(haptics.selection);
  };
  const tap = useTapGesture({ onActivate: flip });
  const gesture = useExclusiveGestures(pan, tap);

  const frontStyle = useAnimatedStyle(() => ({
    backfaceVisibility: 'hidden',
    transform: [{ perspective: 900 }, { rotateX: `${x.get()}deg` }, { rotateY: `${y.get()}deg` }],
  }));
  // The back sits on top, pre-turned 180°, and only shows when the card faces away.
  const backStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    backfaceVisibility: 'hidden',
    transform: [
      { perspective: 900 },
      { rotateX: `${x.get()}deg` },
      { rotateY: `${y.get() + 180}deg` },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('cardSheet.turnHint')}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={() => {
          y.set(settle(settleAngle(y.get(), 0) + 180));
        }}
        style={{ width }}
      >
        <Animated.View style={frontStyle} importantForAccessibility="no-hide-descendants">
          {front({ x, y })}
        </Animated.View>
        <Animated.View style={backStyle} importantForAccessibility="no-hide-descendants">
          {back}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
