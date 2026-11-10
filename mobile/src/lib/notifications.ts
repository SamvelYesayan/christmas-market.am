// Notifications.
//  • LOCAL, opt-in Christmas Calendar reminders: scheduled on this phone only, for the remaining December days.
//    They only invite the user to open the app — whether a window is open is still decided by the server.
//  • PUSH (server → phone) is prepared but NOT active: the backend has no device-token endpoint or push sender yet
//    (see docs/KNOWN_LIMITATIONS.md). `getPushTokenForFutureUse` obtains a token so wiring it later is one call.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { t } from '@/i18n';

export const REMINDER_HOUR = 10;

export function configureNotifications() {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  } catch {
    /* not available in this runtime */
  }
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain === false) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return !!asked.granted;
}

/** Dates (local time) for the remaining December days of this year, or next December if it is over. */
export function reminderDates(now = new Date(), hour = REMINDER_HOUR): Date[] {
  let year = now.getFullYear();
  const lastThisYear = new Date(year, 11, 31, hour);
  if (now > lastThisYear) year += 1;
  const out: Date[] = [];
  for (let day = 1; day <= 31; day++) {
    const d = new Date(year, 11, day, hour, 0, 0);
    if (d > now) out.push(d);
  }
  return out;
}

/** Turn calendar reminders on/off. Returns false when the OS permission is denied. */
export async function setCalendarReminders(on: boolean): Promise<boolean> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!on) return true;
  if (!(await ensurePermission())) return false;
  if (Platform.OS === 'android') {
    // eslint-disable-next-line import/namespace -- AndroidImportance is a re-exported enum the import plugin cannot see
    await Notifications.setNotificationChannelAsync('calendar', { name: t('m.reminders'), importance: Notifications.AndroidImportance.DEFAULT });
  }
  for (const date of reminderDates()) {
    await Notifications.scheduleNotificationAsync({
      content: { title: t('m.remindersTitle'), body: t('m.remindersBodyText'), data: { url: '/advent' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'calendar' },
    });
  }
  return true;
}

/** Expo push token for when the backend gains a device registration endpoint. Not sent anywhere today. */
export async function getPushTokenForFutureUse(): Promise<string | null> {
  try {
    if (!(await ensurePermission())) return null;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return null; // requires an EAS project id (see BUILD_GUIDE.md)
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}
