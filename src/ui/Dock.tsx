import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, useColorScheme, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t, type TKey } from '@/i18n';
import { colors, fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { DOCK_HEIGHT, useDockHidden, useKeyboardVisible } from './dockVisibility';
import { Icon, type IconName } from './icons/Icon';
import { Txt } from './Txt';

// Measurements from the approved canvas (dock-variantes.dc.html, variant A).
const RING = 4; // ring in `bg` around the scan tile, makes it read as a separate piece
const SCAN_W = 58;
const SCAN_H = 74;
const SCAN_TOP = -17; // tile top relative to the pill top
const SCAN_RAISE = RING - SCAN_TOP; // 21: how far the ringed tile rises above the pill
const items: Record<string, { icon: IconName; label: TKey }> = {
  index: { icon: 'home', label: 'dock.home' },
  catalog: { icon: 'catalog', label: 'dock.catalog' },
  scan: { icon: 'scan', label: 'dock.scan' },
  binder: { icon: 'binder', label: 'dock.binder' },
  profile: { icon: 'profile', label: 'dock.profile' },
};

type LabelProps = { text: string; color: string; bold: boolean; size: 10 | 11 };

function DockLabel({ text, color, bold, size }: LabelProps) {
  return (
    <Txt
      variant="label"
      color={color}
      numberOfLines={1}
      adjustsFontSizeToFit
      maxFontSizeMultiplier={1.5}
      minimumFontScale={10 / (size * 1.5)} // shrinks to fit, never below 10 pt
      // Canvas sizes 10/11 sit below the type scale on purpose (dock only).
      style={{
        fontFamily: bold ? fonts.text700 : fonts.text500,
        fontSize: size,
        lineHeight: Math.round(size * 1.35),
      }}
    >
      {text}
    </Txt>
  );
}

export function Dock({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const c = useTheme();
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const hidden = useDockHidden();
  const reduced = useReducedMotion();
  const keyboard = useKeyboardVisible();
  const bottom = Math.max(insets.bottom, 12);

  // With reduced motion the dock simply stays put instead of sliding.
  const slide = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withTiming(!reduced && hidden?.get() ? DOCK_HEIGHT + bottom + SCAN_RAISE : 0, {
          duration: 220,
        }),
      },
    ],
  }));

  if (keyboard) return null;

  // The container includes the raised area above the pill so the whole scan tile is inside
  // its Pressable (Android ignores touches outside a parent's bounds). `box-none` lets taps on
  // the empty strip beside the tile reach the screen below.
  return (
    <Animated.View
      accessibilityRole="tablist"
      pointerEvents="box-none"
      style={[
        { position: 'absolute', left: 16, right: 16, bottom, height: DOCK_HEIGHT + SCAN_RAISE },
        slide,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: DOCK_HEIGHT,
          borderRadius: 26,
          backgroundColor: dark ? c.surface2 : c.surface,
          // Light: hairline of ink at 6 % + soft shadow. Dark: deeper shadow, no hairline.
          borderWidth: dark ? 0 : 1,
          borderColor: `${colors.light.ink}0F`,
          shadowColor: colors.light.ink,
          shadowOpacity: dark ? 0.4 : 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      />
      {/* zIndex + elevation keep items above the pill's Android elevation shadow. */}
      <View
        pointerEvents="box-none"
        style={{ flex: 1, flexDirection: 'row', paddingHorizontal: 10, zIndex: 1, elevation: 9 }}
      >
        {state.routes.map((route, index) => {
          const item = items[route.name];
          if (!item) return null;
          const focused = state.index === index;
          const isScan = route.name === 'scan';
          const color = focused ? c.ink : c.muted;
          const label = t(item.label);

          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              style={
                isScan
                  ? { flex: 1, alignItems: 'center' }
                  : {
                      flex: 1,
                      marginTop: SCAN_RAISE,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                    }
              }
            >
              {isScan ? (
                <View style={{ padding: RING, borderRadius: 14 + RING, backgroundColor: c.bg }}>
                  <View
                    style={{
                      width: SCAN_W,
                      height: SCAN_H,
                      borderRadius: 14,
                      backgroundColor: c.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                    }}
                  >
                    <Icon name="scan" size={26} color={colors.light.ink} strokeWidth={2} />
                    <DockLabel text={label} color={colors.light.ink} bold size={10} />
                  </View>
                </View>
              ) : (
                <>
                  <Icon name={item.icon} color={color} strokeWidth={focused ? 2 : 1.7} />
                  <DockLabel text={label} color={color} bold={focused} size={11} />
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}
