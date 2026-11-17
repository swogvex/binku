import type { ReactNode } from 'react';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { screenPadding } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { useDockScrollHandler, useDockSpace } from './Dock';

/** Scrollable tab root: theme background, safe area, room for the dock, hide-on-scroll. */
export function TabScreen({ children }: { children: ReactNode }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const onScroll = useDockScrollHandler();
  return (
    <Animated.ScrollView
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: screenPadding,
        paddingBottom: useDockSpace(),
        gap: 18,
      }}
    >
      {children}
    </Animated.ScrollView>
  );
}
