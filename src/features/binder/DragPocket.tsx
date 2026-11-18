// One binder pocket: tap opens the card, long-press + drag swaps it with another pocket.
import type { ReactNode } from 'react';
import {
  GestureDetector,
  useExclusiveGestures,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';

type Props = {
  index: number;
  count: number;
  cols: number;
  /** Cell size including the gap, to map a drag distance to a target pocket. */
  stepX: number;
  stepY: number;
  label: string;
  onOpen: () => void;
  onSwap: (from: number, to: number) => void;
  children: ReactNode;
};

export function DragPocket({
  index,
  count,
  cols,
  stepX,
  stepY,
  label,
  onOpen,
  onSwap,
  children,
}: Props) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const lifted = useSharedValue(0);
  const rows = Math.ceil(count / cols);

  const pan = usePanGesture({
    activateAfterLongPress: 300,
    onActivate: () => {
      'worklet';
      lifted.set(withTiming(1, { duration: 120 }));
      scheduleOnRN(haptics.selection);
    },
    onUpdate: (e) => {
      'worklet';
      x.set(e.translationX);
      y.set(e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      const col = Math.min(
        cols - 1,
        Math.max(0, (index % cols) + Math.round(e.translationX / stepX)),
      );
      const row = Math.min(
        rows - 1,
        Math.max(0, Math.floor(index / cols) + Math.round(e.translationY / stepY)),
      );
      const to = Math.min(count - 1, row * cols + col);
      x.set(withTiming(0, { duration: 150 }));
      y.set(withTiming(0, { duration: 150 }));
      lifted.set(withTiming(0, { duration: 150 }));
      if (!e.canceled && to !== index) scheduleOnRN(onSwap, index, to);
    },
  });
  const tap = useTapGesture({
    onActivate: () => {
      'worklet';
      scheduleOnRN(onOpen);
    },
  });
  const gesture = useExclusiveGestures(pan, tap);

  const style = useAnimatedStyle(() => ({
    zIndex: lifted.get() > 0 ? 10 : 0,
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { scale: 1 + lifted.get() * 0.06 },
    ],
  }));

  const actions = [
    ...(index > 0 ? [{ name: 'moveBack', label: t('binder.moveBack') }] : []),
    ...(index < count - 1 ? [{ name: 'moveForward', label: t('binder.moveForward') }] : []),
    { name: 'activate' },
  ];

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={style}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityActions={actions}
        onAccessibilityAction={(e) => {
          const name = e.nativeEvent.actionName;
          if (name === 'activate') onOpen();
          else onSwap(index, name === 'moveBack' ? index - 1 : index + 1);
        }}
      >
        <Animated.View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {children}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
