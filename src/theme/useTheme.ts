import { useColorScheme } from 'react-native';

import { colors, type Colors } from './tokens';

export function useTheme(): Colors {
  return useColorScheme() === 'dark' ? colors.dark : colors.light;
}
