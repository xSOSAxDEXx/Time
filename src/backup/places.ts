/**
 * Sharing places with coworkers (owner request, 4 Nov 2026): a file with
 * just the arrive-and-leave places (names, circles and outlines), nothing
 * else. Importing one adds its places without touching logged days or any
 * other setting. Pure functions; the file picking is in backup.ts.
 */
import type { GeoPlace } from '@/geofence/engine';
import { toKey } from '@/timecard/dates';

import { PLACES_FORMAT, readPlaces } from './format';

export const PLACES_VERSION = 1;

export type PlacesFile = {
  format: typeof PLACES_FORMAT;
  version: number;
  exportedAt: string;
  places: GeoPlace[];
};

/** The places that are set and still on the Locations list, in list order. */
export function sharablePlaces(places: GeoPlace[], locations: string[]): GeoPlace[] {
  return locations
    .map((l) => places.find((p) => p.location === l))
    .filter((p): p is GeoPlace => p != null);
}

export function buildPlacesFile(places: GeoPlace[], now = new Date()): PlacesFile {
  return {
    format: PLACES_FORMAT,
    version: PLACES_VERSION,
    exportedAt: now.toISOString(),
    places,
  };
}

/** e.g. "punchd-places-2026-11-04.json" (the local date). */
export function placesFileName(now = new Date()): string {
  return `punchd-places-${toKey(now)}.json`;
}

export type PlacesParse = { ok: true; places: GeoPlace[] } | { ok: false; message: string };

const NOT_PLACES =
  "This doesn't look like a places file. Choose a file that starts with “punchd-places”.";

/** Reads a places file. Places that can't be read are left out. */
export function parsePlaces(text: string): PlacesParse {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: NOT_PLACES };
  }
  if (typeof data !== 'object' || data == null || Array.isArray(data)) {
    return { ok: false, message: NOT_PLACES };
  }
  const file = data as Record<string, unknown>;
  if (file.format !== PLACES_FORMAT) {
    return {
      ok: false,
      message:
        file.format === 'clocked-backup'
          ? 'This is a backup, not a places file. Ask for a file made with “Share places”.'
          : NOT_PLACES,
    };
  }
  if (typeof file.version !== 'number' || file.version > PLACES_VERSION) {
    return {
      ok: false,
      message: "This file was made by a newer version of Punch'd. Update the app, then try again.",
    };
  }
  const seen = new Set<string>();
  const places = (readPlaces(file.places) ?? [])
    .map((p) => ({ ...p, location: p.location.trim() }))
    .filter((p) => {
      const key = p.location.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (!places.length) return { ok: false, message: 'There are no places in this file.' };
  return { ok: true, places };
}

export type ImportPlan = {
  /** Places this phone doesn't have set yet. */
  fresh: string[];
  /** Places set here already, differently: kept unless the person says replace. */
  differ: string[];
  /** Places already set here exactly the same. */
  same: string[];
};

type Current = { locations: string[]; places: GeoPlace[] };

/** The name on this phone for an imported place: an existing one in any letter case. */
const localName = (locations: string[], name: string) =>
  locations.find((l) => l.toLowerCase() === name.toLowerCase()) ?? name;

const samePlace = (a: GeoPlace, b: GeoPlace) =>
  JSON.stringify({ ...a, location: '' }) === JSON.stringify({ ...b, location: '' });

/** What importing would do, for the question before anything changes. */
export function planImport(current: Current, incoming: GeoPlace[]): ImportPlan {
  const plan: ImportPlan = { fresh: [], differ: [], same: [] };
  for (const p of incoming) {
    const name = localName(current.locations, p.location);
    const mine = current.places.find((m) => m.location === name);
    if (!mine) plan.fresh.push(name);
    else if (samePlace(mine, p)) plan.same.push(name);
    else plan.differ.push(name);
  }
  return plan;
}

/**
 * Adds the imported places: new names join the Locations list, places not
 * set here are set, and places set differently are replaced only if asked.
 */
export function mergePlaces(current: Current, incoming: GeoPlace[], replaceMine: boolean): Current {
  const locations = [...current.locations];
  let places = [...current.places];
  for (const p of incoming) {
    const name = localName(locations, p.location);
    if (!locations.includes(name)) locations.push(name);
    const mine = places.find((m) => m.location === name);
    if (mine && !replaceMine) continue;
    places = [...places.filter((m) => m.location !== name), { ...p, location: name }];
  }
  return { locations, places };
}
