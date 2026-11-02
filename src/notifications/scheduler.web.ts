import type { ReminderPlan } from './plan';
import type { Permission } from './scheduler';

/**
 * The clock-out reminder on the web. Browsers can't reliably notify once the
 * page is closed, so this only works while Clocked is open in a tab: a timer
 * shows a browser notification (when allowed) at the reminder time, and the
 * Week screen shows a banner (ReminderBanner). See the README for the limits.
 */

export function setUpReminders(): void {}

const supported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function getPermission(): Promise<Permission> {
  if (!supported()) return 'unsupported';
  const p = Notification.permission;
  return p === 'default' ? 'undetermined' : p;
}

export async function requestPermission(): Promise<Permission> {
  if (!supported()) return 'unsupported';
  const p = await Notification.requestPermission();
  return p === 'default' ? 'undetermined' : p;
}

let timer: ReturnType<typeof setTimeout> | undefined;

async function show(plan: ReminderPlan) {
  const options = { body: plan.body, icon: 'icons/icon-192.png', tag: 'clocked-clock-out' };
  try {
    // Installed web apps (and Chrome on Android) need the service worker to show one.
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return await reg.showNotification(plan.title, options);
    new Notification(plan.title, options);
  } catch {
    // The banner in the app still shows.
  }
}

export async function syncReminder(
  plan: ReminderPlan | null,
  permission: Permission,
  now = Date.now(),
): Promise<void> {
  clearTimeout(timer);
  timer = undefined;
  if (!plan || permission !== 'granted') return;
  const wait = plan.fireAt.getTime() - now;
  // setTimeout can't wait longer than about 24 days; a shift never needs to.
  if (wait <= 0 || wait > 2 ** 31 - 1) return;
  timer = setTimeout(() => void show(plan), wait);
}

export function openNotificationSettings(): void {}
