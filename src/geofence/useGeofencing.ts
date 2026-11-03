import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { useHydrated } from '@/hooks/useHydrated';
import { useEntries } from '@/store/entries';
import { useGeo } from '@/store/geo';
import { useSettings } from '@/store/settings';
import { isInProgress } from '@/timecard/calc';

import type { GeoAnswer } from './engine';
import { answerGeoPrompt } from './handle';
import {
  cancelClockOutNotification,
  geofencingSupported,
  regionsFor,
  setUpGeoNotifications,
  stopGeofences,
  syncGeofences,
} from './native';

const ANSWERS: GeoAnswer[] = ['yes', 'break', 'extra', 'worked', 'dismiss'];

/**
 * Android forgets the circles when the phone restarts (and can drop them
 * at other times), so the first sync after each start registers them again.
 */
let registeredThisRun = false;

function onResponse(r: Notifications.NotificationResponse | null) {
  const id = r?.notification.request.content.data?.promptId;
  const answer = r?.actionIdentifier as GeoAnswer;
  // Tapping the notification itself just opens the app, where the card waits.
  if (typeof id === 'string' && ANSWERS.includes(answer)) void answerGeoPrompt(id, answer);
}

/**
 * Keeps arrive-and-leave running (CLAUDE.md §3.11): registers the circles
 * with Android when the settings change, handles answers tapped on
 * notifications, and cancels a pending "Clock out?" once you've clocked out.
 * Mounted once, in the tabs layout. Does nothing on the web.
 */
export function useGeofencing(): void {
  const enabled = useSettings((s) => s.geofencing);
  const places = useSettings((s) => s.places);
  const locations = useSettings((s) => s.locations);
  const settingsReady = useHydrated(useSettings);
  const geoReady = useHydrated(useGeo);
  const entries = useEntries((s) => s.entries);
  const pendingExit = useGeo((s) => s.pendingExit);

  useEffect(() => {
    if (!geofencingSupported()) return;
    void setUpGeoNotifications().catch(() => {});
    void Notifications.getLastNotificationResponseAsync().then(onResponse, () => {});
    const sub = Notifications.addNotificationResponseReceivedListener(onResponse);
    return () => sub.remove();
  }, []);

  const regionKey = JSON.stringify(enabled ? regionsFor(places, locations) : []);
  useEffect(() => {
    if (!geofencingSupported() || !settingsReady || !geoReady) return;
    const regions = JSON.parse(regionKey) as ReturnType<typeof regionsFor>;
    const { registeredKey, setRegisteredKey } = useGeo.getState();
    const run = regions.length
      ? syncGeofences(regions, registeredThisRun ? registeredKey : null)
      : stopGeofences().then(() => null);
    registeredThisRun = true;
    // Without "all the time" location access Android refuses; Settings explains that.
    run.then(setRegisteredKey, () => setRegisteredKey(null));
  }, [regionKey, settingsReady, geoReady]);

  // Clocked out by hand after leaving, or already answered: the "Clock out?"
  // notification isn't needed.
  const shiftOpen =
    !!pendingExit && !!entries[pendingExit.date] && isInProgress(entries[pendingExit.date]);
  const settled = !!pendingExit && (!shiftOpen || !!pendingExit.answered);
  useEffect(() => {
    if (geofencingSupported() && settled) void cancelClockOutNotification().catch(() => {});
  }, [settled]);
}
