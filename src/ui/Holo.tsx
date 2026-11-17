import { Accelerometer } from 'expo-sensors';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { era } from '@/theme/tokens';

const bands = [era.tomato, era.mango, era.mint, era.cobalt, era.bubblegum, era.tomato];

/**
 * Iridescent overlay for special cards (lucky draw, POB, event, user-marked).
 * Tilting the phone slides the shine. Uses the accelerometer (no permission needed on iOS or
 * Android). Hidden entirely with reduced motion.
 */
export function Holo({ width }: { width: number }) {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    Accelerometer.setUpdateInterval(60);
    const sub = Accelerometer.addListener((a) => {
      // a.x / a.y are gravity in g (-1..1): map tilt to a slide of up to ±¼ card width.
      x.set(withTiming(Math.max(-1, Math.min(1, a.x)) * width * 0.25, { duration: 120 }));
      y.set(withTiming(Math.max(-1, Math.min(1, a.y)) * width * 0.25, { duration: 120 }));
    });
    return () => sub.remove();
  }, [reduced, width, x, y]);

  const shine = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }));

  if (reduced) return null;

  // The gradient is drawn 2× the card so it never shows an edge while sliding.
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <Animated.View
        style={[
          { position: 'absolute', left: '-50%', top: '-50%', width: '200%', height: '200%' },
          shine,
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="holo" x1="0" y1="0" x2="1" y2="1">
              {bands.map((c, i) => (
                <Stop key={i} offset={i / (bands.length - 1)} stopColor={c} stopOpacity={0.28} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#holo)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
