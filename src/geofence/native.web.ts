/**
 * Web version: arrive-and-leave isn't possible in a browser (it can't watch
 * your location with the page closed), so everything here does nothing and
 * Settings says it's in the Android app only.
 */
import type { GeoPlace, GeoPrompt, PendingExit } from './engine';
import type { LocationAccess } from './native';

export const GEOFENCE_TASK = 'clocked-geofence';
export const CLOCK_OUT_NOTIFICATION = 'geo-clock-out';
export const geofencingSupported = () => false;

export async function getLocationAccess(): Promise<LocationAccess> {
  return 'denied';
}
export async function requestLocationAccess(): Promise<LocationAccess> {
  return 'denied';
}
export async function currentPosition(): Promise<{ latitude: number; longitude: number }> {
  throw new Error('Not available on the web');
}
export function regionsFor(_places: GeoPlace[], _locations: string[]): never[] {
  return [];
}
export async function syncGeofences(): Promise<string | null> {
  return null;
}
export async function stopGeofences(): Promise<void> {}
export async function setUpGeoNotifications(): Promise<void> {}
export async function notifyPrompt(_p: GeoPrompt): Promise<void> {}
export async function scheduleClockOutNotification(_pe: PendingExit): Promise<void> {}
export async function cancelClockOutNotification(): Promise<void> {}
export async function dismissPromptNotification(_p: GeoPrompt): Promise<void> {}
