import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Keyboard } from 'react-native';
import {
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Dock show/hide state shared between the dock and the tab screens that scroll under it.
export const DOCK_HEIGHT = 66;

const DockHidden = createContext<SharedValue<number> | null>(null);

export function DockProvider({ children }: { children: ReactNode }) {
  const hidden = useSharedValue(0);
  return <DockHidden.Provider value={hidden}>{children}</DockHidden.Provider>;
}

/** Bottom space a tab screen must leave so content can scroll above the dock. */
export function useDockSpace() {
  return useSafeAreaInsets().bottom + DOCK_HEIGHT + 24;
}

/** Scroll handler for tab screens: dock hides on scroll down, returns on scroll up. */
export function useDockScrollHandler() {
  const hidden = useContext(DockHidden);
  const lastY = useSharedValue(0);
  return useAnimatedScrollHandler((e) => {
    if (!hidden) return;
    const y = e.contentOffset.y;
    const dy = y - lastY.value;
    if (y > 0 && Math.abs(dy) < 12) return; // ignore jitter
    hidden.set(y > 0 && dy > 0 ? 1 : 0); // .set(): React Compiler forbids assigning to context values
    lastY.value = y;
  });
}

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

export const useDockHidden = () => useContext(DockHidden);
