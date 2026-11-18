import { Accelerometer } from 'expo-sensors';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors, era } from '@/theme/tokens';

const bands = [era.tomato, era.mango, era.mint, era.cobalt, era.bubblegum, era.tomato];

/**
 * Iridescent overlay for special cards (lucky draw, POB, event, user-marked).
 * Tilting the phone slides the shine. Uses the accelerometer (no permission needed on iOS or
 * Android). Hidden entirely with reduced motion.
 */
type Props = {
  width: number;
  /** Card rotation in degrees when the user turns it with a finger (3D card view). */
  rotateX?: SharedValue<number>;
  rotateY?: SharedValue<number>;
};

export function Holo({ width, rotateX, rotateY }: Props) {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    Accelerometer.setUpdateInterval(60);
    const sub = Accelerometer.addListener((a) => {
      // a.x / a.y are gravity in g (-1..1): map tilt to a slide of up to ±0.4 card width.
      x.set(withTiming(Math.max(-1, Math.min(1, a.x)) * width * 0.4, { duration: 120 }));
      y.set(withTiming(Math.max(-1, Math.min(1, a.y)) * width * 0.4, { duration: 120 }));
    });
    return () => sub.remove();
  }, [reduced, width, x, y]);

  // Phone tilt and finger rotation add up, so both move the shine.
  const shine = useAnimatedStyle(() => {
    const dragX = rotateY ? Math.sin((rotateY.get() * Math.PI) / 180) * width * 0.3 : 0;
    const dragY = rotateX ? Math.sin((rotateX.get() * Math.PI) / 180) * width * 0.3 : 0;
    return { transform: [{ translateX: x.get() + dragX }, { translateY: y.get() - dragY }] };
  });
  // The white glint travels twice as far as the colours: that parallax is what reads as "holo".
  const glint = useAnimatedStyle(() => {
    const dragX = rotateY ? Math.sin((rotateY.get() * Math.PI) / 180) * width * 0.6 : 0;
    const dragY = rotateX ? Math.sin((rotateX.get() * Math.PI) / 180) * width * 0.6 : 0;
    return {
      transform: [{ translateX: x.get() * 2 + dragX }, { translateY: y.get() * 2 - dragY }],
    };
  });

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
                <Stop key={i} offset={i / (bands.length - 1)} stopColor={c} stopOpacity={0.25} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#holo)" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          { position: 'absolute', left: '-50%', top: '-50%', width: '200%', height: '200%' },
          glint,
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="glint" x1="0" y1="0" x2="1" y2="1">
              <Stop offset={0.44} stopColor={colors.light.surface} stopOpacity={0} />
              <Stop offset={0.5} stopColor={colors.light.surface} stopOpacity={0.3} />
              <Stop offset={0.56} stopColor={colors.light.surface} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#glint)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
