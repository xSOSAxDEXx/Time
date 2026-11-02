import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import type { ReminderPlan } from './plan';

/**
 * The clock-out reminder on the phone: one local notification, scheduled on
 * the device with expo-notifications, so it arrives with the app closed.
 * Nothing goes through a server.
 */

export type Permission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

const ID = 'clocked-clock-out';
const CHANNEL = 'clock-out';

/** Shows the reminder as a banner even while Clocked is open. Call once at start-up. */
export function setUpReminders(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function getPermission(): Promise<Permission> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

/** Asks the phone for permission. Only called after Clocked has explained why. */
export async function requestPermission(): Promise<Permission> {
  const p = await Notifications.requestPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

let channelReady = false;
async function ensureChannel() {
  if (Platform.OS !== 'android' || channelReady) return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Clock-out reminder',
    description: 'When you hit your hours for the day',
    // Exported through a re-export the lint plugin can't follow; the type check covers it.
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.HIGH,
  });
  channelReady = true;
}

/**
 * Makes the scheduled reminder match `plan`: replaces any earlier one, or
 * just cancels it when there's no plan, the time has passed, or Clocked
 * isn't allowed to notify.
 */
export async function syncReminder(
  plan: ReminderPlan | null,
  permission: Permission,
  now = Date.now(),
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(ID);
  if (!plan || permission !== 'granted' || plan.fireAt.getTime() <= now) return;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: { title: plan.title, body: plan.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: plan.fireAt,
      channelId: CHANNEL,
    },
  });
}

/** Opens Clocked's page in the phone's settings, to turn notifications back on. */
export function openNotificationSettings(): void {
  void Linking.openSettings();
}
