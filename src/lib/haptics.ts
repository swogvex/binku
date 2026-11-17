import * as Haptics from 'expo-haptics';

// Fire-and-forget: a missing haptic must never break a tap.
const safe = (p: Promise<void>) => p.catch(() => {});

export const haptics = {
  selection: () => safe(Haptics.selectionAsync()),
  cardPlaced: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
