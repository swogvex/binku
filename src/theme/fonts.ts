import { fonts } from './tokens';

// Loaded at runtime from bundled files (no remote fetch) so names match on iOS and Android.
export const fontFiles = {
  [fonts.display800]: require('@/assets/fonts/BigShoulders_800ExtraBold.ttf'),
  [fonts.display900]: require('@/assets/fonts/BigShoulders_900Black.ttf'),
  [fonts.text400]: require('@/assets/fonts/InstrumentSans_400Regular.ttf'),
  [fonts.text500]: require('@/assets/fonts/InstrumentSans_500Medium.ttf'),
  [fonts.text600]: require('@/assets/fonts/InstrumentSans_600SemiBold.ttf'),
  [fonts.text700]: require('@/assets/fonts/InstrumentSans_700Bold.ttf'),
  [fonts.hangul]: require('@/assets/fonts/Pretendard-Regular.otf'),
};
