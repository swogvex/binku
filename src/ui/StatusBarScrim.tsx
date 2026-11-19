import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';

/** Screen-coloured strip under the status bar so scrolled content never mixes with the clock. */
export function StatusBarScrim() {
  const c = useTheme();
  const { top } = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: top,
        backgroundColor: c.bg,
      }}
    />
  );
}
