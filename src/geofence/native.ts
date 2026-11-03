import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { MIN_ABSENCE_MS, type GeoPlace, type GeoPrompt, type PendingExit } from './engine';
import { promptText } from './text';

/**
 * The phone side of arrive-and-leave (CLAUDE.md §3.11), Android only: the
 * circles are registered with Android, which wakes Punch'd's background task
 * on arriving or leaving, even with the app closed. Location never leaves
 * the phone, and only the circles are saved (no location history).
 */

export const GEOFENCE_TASK = 'clocked-geofence';
export const CLOCK_OUT_NOTIFICATION = 'geo-clock-out';

export const geofencingSupported = () => Platform.OS === 'android';

export type LocationAccess = 'always' | 'whileUsing' | 'undetermined' | 'denied';

export async function getLocationAccess(): Promise<LocationAccess> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (!fg.granted) return fg.canAskAgain ? 'undetermined' : 'denied';
  const bg = await Location.getBackgroundPermissionsAsync();
  return bg.granted ? 'always' : 'whileUsing';
}

/**
 * Asks for location "while using" and then "all the time" (Android shows the
 * second on its settings page). Only called after Punch'd has explained why.
 */
export async function requestLocationAccess(): Promise<LocationAccess> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return fg.canAskAgain ? 'undetermined' : 'denied';
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.granted ? 'always' : 'whileUsing';
}

/** Where the phone is now, for "Set to where I am now". */
export async function currentPosition(): Promise<{ latitude: number; longitude: number }> {
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

/** The circles to watch: places still in the Locations list. */
export function regionsFor(places: GeoPlace[], locations: string[]): Location.LocationRegion[] {
  return places
    .filter((p) => locations.includes(p.location))
    .map((p) => ({
      identifier: p.location,
      latitude: p.latitude,
      longitude: p.longitude,
      radius: p.radiusMeters,
      notifyOnEnter: true,
      notifyOnExit: true,
    }));
}

/**
 * Makes what Android watches match the settings. Returns the key of what's
 * registered (null when nothing is), so it's only redone when it changes.
 */
export async function syncGeofences(
  regions: Location.LocationRegion[],
  registeredKey: string | null,
): Promise<string | null> {
  const key = regions.length ? JSON.stringify(regions) : null;
  const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false);
  if (!key) {
    if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK);
    return null;
  }
  if (started && key === registeredKey) return key;
  // Registering again replaces what Android had for this task.
  await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
  return key;
}

export async function stopGeofences(): Promise<void> {
  if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false)) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
}

/** The notification buttons for each kind of question (same answers as the in-app cards). */
function category(p: GeoPrompt): string {
  if (p.kind === 'break')
    return `geo-break${p.clockedOut ? '-out' : ''}${p.usualHours ? '-usual' : ''}`;
  if (p.kind === 'travel') return `geo-travel${p.clockedOut ? '-out' : ''}`;
  return `geo-${p.kind}`;
}

const SAMPLES: GeoPrompt[] = [
  { id: '', kind: 'clockIn', date: '', place: '', at: 0 },
  { id: '', kind: 'clockOut', date: '', place: '', at: 0 },
  { id: '', kind: 'break', date: '', place: '', from: 0, to: 0, clockedOut: false },
  { id: '', kind: 'break', date: '', place: '', from: 0, to: 0, clockedOut: true },
  {
    id: '',
    kind: 'break',
    date: '',
    place: '',
    from: 0,
    to: 0,
    clockedOut: false,
    usualHours: 0.5,
  },
  { id: '', kind: 'break', date: '', place: '', from: 0, to: 0, clockedOut: true, usualHours: 0.5 },
  {
    id: '',
    kind: 'travel',
    date: '',
    fromPlace: '',
    toPlace: '',
    from: 0,
    to: 0,
    clockedOut: false,
  },
  {
    id: '',
    kind: 'travel',
    date: '',
    fromPlace: '',
    toPlace: '',
    from: 0,
    to: 0,
    clockedOut: true,
  },
];

/** Registers the button sets once at start-up. */
export async function setUpGeoNotifications(): Promise<void> {
  for (const sample of SAMPLES) {
    const actions = promptText(sample).actions.map((a) => ({
      identifier: a.answer,
      // A break's length varies, so its notification buttons say just "Log break".
      buttonTitle:
        sample.kind === 'break' && a.answer === 'break'
          ? 'Log break'
          : a.answer === 'extra'
            ? 'Log + usual break'
            : a.label,
      options: { opensAppToForeground: true },
    }));
    await Notifications.setNotificationCategoryAsync(category(sample), actions);
  }
}

function content(p: GeoPrompt) {
  const t = promptText(p);
  return {
    title: t.title,
    body: t.body,
    categoryIdentifier: category(p),
    data: { promptId: p.id },
  };
}

/** Sends a question as a notification now, or at `at`. */
export async function notifyPrompt(p: GeoPrompt, at: number | null = null): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: p.id,
    content: content(p),
    trigger:
      at == null ? null : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

/** Takes back a question's notification, sent or still scheduled. */
export async function cancelPromptNotification(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
  await Notifications.dismissNotificationAsync(id).catch(() => {});
}

/** "Clock out?" for 5 minutes after leaving; cancelled if they come back sooner. */
export async function scheduleClockOutNotification(pe: PendingExit): Promise<void> {
  const prompt: GeoPrompt = {
    id: `clockOut-${pe.at}`,
    kind: 'clockOut',
    date: pe.date,
    place: pe.place,
    at: pe.at,
  };
  await Notifications.scheduleNotificationAsync({
    identifier: CLOCK_OUT_NOTIFICATION,
    content: content(prompt),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: pe.at + MIN_ABSENCE_MS + 1000,
    },
  });
}

export async function cancelClockOutNotification(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(CLOCK_OUT_NOTIFICATION);
  await Notifications.dismissNotificationAsync(CLOCK_OUT_NOTIFICATION).catch(() => {});
}

/** Removes an answered question's notification from the shade. */
export async function dismissPromptNotification(p: GeoPrompt): Promise<void> {
  const id = p.kind === 'clockOut' ? CLOCK_OUT_NOTIFICATION : p.id;
  await Notifications.dismissNotificationAsync(id).catch(() => {});
}
