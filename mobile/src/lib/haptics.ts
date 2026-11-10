// Haptic feedback that respects the user's in-app setting.
import * as Haptics from 'expo-haptics';
import { usePrefs } from '@/state/prefs';

const on = () => usePrefs.getState().haptics;

export const haptic = {
  tap: () => { if (on()) void Haptics.selectionAsync().catch(() => {}); },
  press: () => { if (on()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  thud: () => { if (on()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); },
  success: () => { if (on()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  warning: () => { if (on()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
  error: () => { if (on()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); },
};
