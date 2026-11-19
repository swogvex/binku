import { StyleSheet, View } from 'react-native';
import Animated, {
  SensorType,
  useAnimatedReaction,
  useAnimatedSensor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors, era } from '@/theme/tokens';

const bands = [era.tomato, era.mango, era.mint, era.cobalt, era.bubblegum, era.tomato];

/**
 * Iridescent overlay for special cards (lucky draw, POB, event, user-marked).
 * Tilting the phone slides the shine. Reads the gravity sensor on the UI thread (no JS round
 * trip, so it follows the phone without lag; no permission on iOS or Android). Every card shares
 * one native sensor. Hidden entirely with reduced motion.
 */
type Props = {
  width: number;
  /** Card rotation in degrees when the user turns it with a finger (3D card view). */
  rotateX?: SharedValue<number>;
  rotateY?: SharedValue<number>;
};

export function Holo({ width, rotateX, rotateY }: Props) {
  const reduced = useReducedMotion();
  // 30 readings a second is smooth for a sheen and half the work of 60.
  const gravity = useAnimatedSensor(SensorType.GRAVITY, { interval: 33 });
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  // Gravity in m/s² (both platforms): ±9.81 on an axis = fully tilted → slide up to ±0.4 width.
  // Changes under 1 px are sensor noise: skipping them lets a still phone stop redrawing.
  useAnimatedReaction(
    () => gravity.sensor.get(),
    (g) => {
      const nx = Math.max(-1, Math.min(1, g.x / 9.81)) * width * 0.4;
      const ny = Math.max(-1, Math.min(1, g.y / 9.81)) * width * 0.4;
      if (Math.abs(nx - x.get()) < 1 && Math.abs(ny - y.get()) < 1) return;
      x.set(nx);
      y.set(ny);
    },
  );

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
