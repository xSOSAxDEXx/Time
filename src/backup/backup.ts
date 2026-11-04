import type { GeoPlace } from '@/geofence/engine';
import { useEntries } from '@/store/entries';
import { pickSettings, useSettings } from '@/store/settings';
import { loggedDates, timeCard } from '@/timecard/calc';
import { buildCsv, csvFileName } from '@/timecard/csv';
import { addDays, formatShortDate, fromKey, mondayOf, toKey } from '@/timecard/dates';

import { pickBackupText, saveFile } from './fileIO';
import { backupFileName, buildBackup, parseBackup, type ParsedBackup } from './format';
import {
  buildPlacesFile,
  mergePlaces,
  parsePlaces,
  placesFileName,
  planImport,
  sharablePlaces,
  type ImportPlan,
} from './places';

export type Outcome = { ok: boolean; message: string };

const CANT_SHARE: Outcome = {
  ok: false,
  message: "This device can't share files right now. Please try again.",
};

/** Builds the backup from what's on this device and hands it to the person to save. */
export async function exportBackup(now = new Date()): Promise<Outcome> {
  const { entries } = useEntries.getState();
  const backup = buildBackup(pickSettings(useSettings.getState()), entries, now);
  const days = backup.entries.length;
  const result = await saveFile(
    backupFileName(now),
    JSON.stringify(backup, null, 1),
    'application/json',
    "Save your Punch'd backup",
  );
  if (result === 'unavailable') return CANT_SHARE;
  return {
    ok: true,
    message: `Backup made with ${days} ${days === 1 ? 'day' : 'days'} and your settings. Keep the file somewhere safe, like Files or your cloud drive.`,
  };
}

/** The spreadsheet export, with company holidays counted like everywhere else. */
export async function exportCsv(now = new Date()): Promise<Outcome> {
  const today = toKey(now);
  const real = useEntries.getState().entries;
  const first = loggedDates(real)[0];
  if (!first) return { ok: false, message: 'Nothing logged yet, so there is nothing to export.' };
  const { holidays, autoHolidays, requiredHours } = useSettings.getState();
  const { entries } = timeCard(
    real,
    { rules: holidays, auto: autoHolidays, requiredHours },
    mondayOf(first),
    addDays(mondayOf(today), 6),
  );
  const result = await saveFile(
    csvFileName(now),
    buildCsv(entries, today, requiredHours),
    'text/csv',
    'Save your time card for Excel',
  );
  if (result === 'unavailable') return CANT_SHARE;
  return { ok: true, message: 'Spreadsheet made. It opens in Excel, Numbers or Google Sheets.' };
}

export type RestoreChoice = { ok: true; backup: ParsedBackup } | Outcome;

/** Asks the person for a file and reads it. Null if they cancelled. Nothing changes yet. */
export async function chooseRestoreFile(): Promise<RestoreChoice | null> {
  let text: string | null;
  try {
    text = await pickBackupText();
  } catch {
    return { ok: false, message: "That file couldn't be opened. Please try again." };
  }
  if (text == null) return null;
  const parsed = parseBackup(text);
  if (!parsed.ok) return parsed;
  const { ok: _ok, ...backup } = parsed;
  return { ok: true, backup };
}

const SOURCE_NAMES = {
  clocked: "Punch'd backup",
  'html-data': 'Time card page data file',
  'html-backup': 'Time card page backup',
} as const;

const withYear = (key: string) => `${formatShortDate(key)}, ${fromKey(key).getFullYear()}`;

/** What a file holds, in a sentence or two, for the "replace?" question. */
export function describeBackup(b: ParsedBackup): string {
  const dates = Object.keys(b.entries).sort();
  const days = dates.length;
  const made = b.exportedAt ? ` made ${withYear(toKey(new Date(b.exportedAt)))}` : '';
  const span = days
    ? `${days} ${days === 1 ? 'day' : 'days'} logged, ${withYear(dates[0])} – ${withYear(dates[days - 1])}`
    : 'No days logged';
  return `${SOURCE_NAMES[b.source]}${made}. ${span}.`;
}

/** Replaces what's on this device with the file's days and settings. */
export function applyRestore(b: ParsedBackup): Outcome {
  useEntries.getState().replaceAll(b.entries);
  if (b.source === 'clocked') useSettings.getState().replaceAll(b.settings);
  else useSettings.getState().update(b.settings);
  const days = Object.keys(b.entries).length;
  const notes = [
    b.skippedDays
      ? `${b.skippedDays} ${b.skippedDays === 1 ? "day couldn't" : "days couldn't"} be read and ${b.skippedDays === 1 ? 'was' : 'were'} skipped.`
      : '',
    b.repairedDays
      ? `${b.repairedDays} ${b.repairedDays === 1 ? 'day had' : 'days had'} something unreadable, left blank.`
      : '',
    b.skippedSettings
      ? `${b.skippedSettings} ${b.skippedSettings === 1 ? "setting couldn't" : "settings couldn't"} be read and ${b.source === 'clocked' ? 'went back to the default' : 'stayed as before'}.`
      : '',
  ].filter(Boolean);
  return {
    ok: true,
    message: [`Restored ${days} ${days === 1 ? 'day' : 'days'}.`, ...notes].join(' '),
  };
}

// ---------- places to share with coworkers (places.ts) ----------

/** Saves a file of just the places set for arrive and leave. */
export async function sharePlaces(now = new Date()): Promise<Outcome> {
  const { places, locations } = useSettings.getState();
  const set = sharablePlaces(places, locations);
  if (!set.length)
    return { ok: false, message: 'No places are set yet, so there is nothing to share.' };
  const result = await saveFile(
    placesFileName(now),
    JSON.stringify(buildPlacesFile(set, now), null, 1),
    'application/json',
    "Share your Punch'd places",
  );
  if (result === 'unavailable') return CANT_SHARE;
  return {
    ok: true,
    message: `Places file made with ${set.length} ${set.length === 1 ? 'place' : 'places'}. It has only your places: no hours, pay or other settings.`,
  };
}

export type PlacesChoice = { ok: true; places: GeoPlace[]; plan: ImportPlan } | Outcome;

/** Asks for a places file and works out what it would add. Null if cancelled. */
export async function choosePlacesFile(): Promise<PlacesChoice | null> {
  let text: string | null;
  try {
    text = await pickBackupText();
  } catch {
    return { ok: false, message: "That file couldn't be opened. Please try again." };
  }
  if (text == null) return null;
  const parsed = parsePlaces(text);
  if (!parsed.ok) return parsed;
  const { places, locations } = useSettings.getState();
  return {
    ok: true,
    places: parsed.places,
    plan: planImport({ places, locations }, parsed.places),
  };
}

/** Adds the file's places. Logged days and other settings stay as they are. */
export function applyPlaces(incoming: GeoPlace[], replaceMine: boolean): Outcome {
  const { places, locations, update } = useSettings.getState();
  const plan = planImport({ places, locations }, incoming);
  update(mergePlaces({ places, locations }, incoming, replaceMine));
  const added = plan.fresh.length + (replaceMine ? plan.differ.length : 0);
  const kept = replaceMine ? 0 : plan.differ.length;
  return {
    ok: true,
    message: [
      added ? `Added ${added} ${added === 1 ? 'place' : 'places'}.` : 'Nothing new to add.',
      kept
        ? `Kept your own ${kept === 1 ? 'version' : 'versions'} of ${listNames(plan.differ)}.`
        : '',
    ]
      .filter(Boolean)
      .join(' '),
  };
}

/** "A", "A and B", "A, B and C". */
export function listNames(names: string[]): string {
  return names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
