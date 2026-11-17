import type { NativeStackNavigationOptions } from 'expo-router/native-stack';

/**
 * Screen options that turn a Stack route into a native sheet:
 * iOS sheet with grabber and detents, Android bottom sheet with dimmed scrim.
 */
export const sheetOptions: NativeStackNavigationOptions = {
  presentation: 'formSheet',
  sheetGrabberVisible: true,
  sheetAllowedDetents: [0.5, 1],
  sheetCornerRadius: 28,
  headerShown: false,
};
