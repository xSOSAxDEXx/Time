/**
 * The backup file (CLAUDE.md §3.7): one JSON file with every setting and
 * every logged day. It's made on the device and goes only where the person
 * sends it.
 *
 * Restore also reads the time card HTML page's files (its data file
 * `timecard-data.json` and its Backup file), so the owner can bring their
 * history in on their own device. Nothing from those files is ever bundled
 * with the app.
 *
 * Nothing in a file is trusted: every field is checked, and parts that
 * can't be read are skipped (a day) or left blank (a field).
 */
import type { GeoPlace } from '@/geofence/engine';
import {
  DEFAULT_DRIVING,
  DEFAULT_FINANCE,
  DEFAULT_SETTINGS,
  type Bill,
  type Deduction,
  type Driving,
  type Finance,
  type OvertimeRule,
  type Route,
  type Settings,
} from '@/store/settings';
import { isClockTime, isDateKey, toKey } from '@/timecard/dates';
import type { HolidayRule } from '@/timecard/holidays';
import { isEmptyEntry, type Entries, type Entry, type Travel, type Trip } from '@/timecard/types';

export const BACKUP_FORMAT = 'clocked-backup';
export const BACKUP_VERSION = 1;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  settings: Settings;
  /** Logged days, oldest first. Company holidays counted automatically aren't included. */
  entries: Entry[];
};

export function buildBackup(settings: Settings, entries: Entries, now = new Date()): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    settings,
    entries: Object.values(entries)
      .filter((e) => !isEmptyEntry(e))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
}

/** e.g. "clocked-backup-2026-11-02.json" (the local date). */
export function backupFileName(now = new Date()): string {
  return `clocked-backup-${toKey(now)}.json`;
}

/** Where a file came from. */
export type BackupSource = 'clocked' | 'html-data' | 'html-backup';

export type ParsedBackup = {
  source: BackupSource;
  /** When a Clocked backup was made (ISO), if the file says. */
  exportedAt?: string;
  entries: Entries;
  /**
   * The settings the file holds. A Clocked backup replaces every setting
   * (missing ones go back to their defaults); the HTML page only had some,
   * and the rest are left as they are.
   */
  settings: Partial<Settings>;
  /** Days that couldn't be read at all. */
  skippedDays: number;
  /** Days kept with one or more fields left blank. */
  repairedDays: number;
  /** Settings that couldn't be read and were left out. */
  skippedSettings: number;
};

export type ParseResult = ({ ok: true } & ParsedBackup) | { ok: false; message: string };

/** Bigger than any real time card file; refuses anything that isn't one. */
export const MAX_FILE_CHARS = 20_000_000;

const NOT_A_BACKUP =
  "This doesn't look like a Clocked backup or a time card file. Choose a file that starts with “clocked-backup”, or the time card page's data or backup file.";

const MAX_TEXT = 200;
const MAX_COMMENT = 5000;
const MAX_LIST = 100;
const MAX_HOLIDAYS = 100;
const MAX_TRIPS = 50;
const MAX_MILES = 5000;
const MAX_MONEY = 1_000_000;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v != null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';

/** A number, or a number written as text (the HTML page sometimes saved "1.5"). */
function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    if (!v.trim()) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (v == null) return 0;
  return null;
}

// ---------- days ----------

type Fields = {
  date: unknown;
  start: unknown;
  end: unknown;
  breakHours: unknown;
  remoteHours: unknown;
  timeOffHours: unknown;
  timeOffType: unknown;
  travel: unknown;
  location: unknown;
  comment: unknown;
  trips?: unknown;
  skipHoliday?: unknown;
};

/** Checks one day's fields. Null when the date can't be read. */
function readDay(f: Fields): { entry: Entry; repaired: boolean } | null {
  if (!isDateKey(f.date)) return null;
  let repaired = false;
  const time = (v: unknown): string => {
    if (v == null || v === '') return '';
    if (isString(v)) {
      // Accept "8:05" as well as "08:05".
      const padded = /^\d:\d{2}$/.test(v) ? `0${v}` : v;
      if (isClockTime(padded)) return padded;
    }
    repaired = true;
    return '';
  };
  const hours = (v: unknown): number => {
    const n = toNumber(v);
    if (n != null && n >= 0 && n <= 24) return n;
    repaired = true;
    return 0;
  };
  const str = (v: unknown, max = MAX_TEXT): string => {
    if (v == null) return '';
    if (isString(v)) return v.slice(0, max);
    repaired = true;
    return '';
  };
  const travel = ((): Travel => {
    const t = str(f.travel).trim().toLowerCase();
    if (t === 'yes') return 'Yes';
    if (t === 'no') return 'No';
    if (t) repaired = true;
    return '';
  })();
  const entry: Entry = {
    date: f.date,
    start: time(f.start),
    end: time(f.end),
    breakHours: hours(f.breakHours),
    remoteHours: hours(f.remoteHours),
    timeOffHours: hours(f.timeOffHours),
    timeOffType: str(f.timeOffType).trim(),
    travel,
    location: str(f.location).trim(),
    comment: str(f.comment, MAX_COMMENT),
  };
  if (Array.isArray(f.trips)) {
    const trips = f.trips.slice(0, MAX_TRIPS).map(readTrip);
    if (trips.some((t) => t == null)) repaired = true;
    const ok = trips.filter((t): t is Trip => t != null);
    if (ok.length) entry.trips = ok;
  } else if (f.trips != null) repaired = true;
  if (f.skipHoliday === true) entry.skipHoliday = true;
  return { entry, repaired };
}

type DayResults = { entries: Entries; skippedDays: number; repairedDays: number };

function collectDays(raws: { key?: string; value: unknown }[], html: boolean): DayResults {
  const out: DayResults = { entries: {}, skippedDays: 0, repairedDays: 0 };
  for (const { key, value } of raws) {
    if (!isObject(value)) {
      out.skippedDays++;
      continue;
    }
    const fields: Fields = html
      ? {
          // The HTML page keyed days by date and used short field names.
          date: value.date ?? key,
          start: value.start,
          end: value.end,
          breakHours: value.brk,
          remoteHours: value.remote,
          timeOffHours: value.off,
          timeOffType: value.offType,
          travel: value.travel,
          location: value.loc,
          comment: value.comment,
        }
      : (value as Fields);
    const day = readDay(fields);
    if (!day) {
      out.skippedDays++;
      continue;
    }
    if (isEmptyEntry(day.entry)) continue;
    if (day.repaired) out.repairedDays++;
    out.entries[day.entry.date] = day.entry;
  }
  return out;
}

function readTrip(v: unknown): Trip | null {
  if (!isObject(v) || !isString(v.from) || !isString(v.to)) return null;
  const from = v.from.trim().slice(0, MAX_TEXT);
  const to = v.to.trim().slice(0, MAX_TEXT);
  if (!from || !to) return null;
  return inRange(v.miles, 0, MAX_MILES) ? { from, to, miles: v.miles } : { from, to };
}

// ---------- settings ----------

function readList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const items = v
    .filter(isString)
    .map((s) => s.trim().slice(0, MAX_TEXT))
    .filter(Boolean);
  return [...new Set(items)].slice(0, MAX_LIST);
}

const inRange = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isInt = (v: unknown, min: number, max: number): v is number =>
  inRange(v, min, max) && Number.isInteger(v);

function readHoliday(v: unknown): HolidayRule | null {
  if (!isObject(v) || !isString(v.id) || !isString(v.name) || !v.name.trim()) return null;
  const base = { id: v.id.slice(0, MAX_TEXT), name: v.name.trim().slice(0, MAX_TEXT) };
  if (v.kind === 'fixed' && isInt(v.month, 1, 12) && isInt(v.day, 1, 31)) {
    return { ...base, kind: 'fixed', month: v.month, day: v.day, observed: v.observed === true };
  }
  if (
    v.kind === 'weekday' &&
    isInt(v.month, 1, 12) &&
    isInt(v.weekday, 0, 6) &&
    (v.nth === -1 || isInt(v.nth, 1, 5)) &&
    isInt(v.offsetDays, -14, 14)
  ) {
    return {
      ...base,
      kind: 'weekday',
      month: v.month,
      weekday: v.weekday,
      nth: v.nth as number,
      offsetDays: v.offsetDays,
    };
  }
  return null;
}

const id = (v: unknown, i: number) => (isString(v) && v ? v.slice(0, MAX_TEXT) : `item-${i}`);
const pct = (v: unknown, fallback: number) => (inRange(v, 0, 100) ? v : fallback);
const money = (v: unknown) => (inRange(v, 0, MAX_MONEY) ? v : null);

function readFinance(v: unknown): Finance | null {
  if (!isObject(v)) return null;
  const schedules = ['weekly', 'biweekly', 'semimonthly', 'monthly'] as const;
  const deductions: Deduction[] = Array.isArray(v.deductions)
    ? v.deductions.slice(0, MAX_LIST).flatMap((d, i): Deduction[] => {
        if (!isObject(d) || !isString(d.name)) return [];
        const unit =
          d.unit === 'percent' || d.unit === 'paycheck' || d.unit === 'month' ? d.unit : null;
        const kind = d.kind === 'retirement' || d.kind === 'health' ? d.kind : 'other';
        const amount =
          unit === 'percent' ? (inRange(d.amount, 0, 100) ? d.amount : null) : money(d.amount);
        if (!unit || amount == null) return [];
        return [
          {
            id: id(d.id, i),
            name: d.name.slice(0, MAX_TEXT),
            kind,
            amount,
            unit,
            pretax: d.pretax === true,
          },
        ];
      })
    : [];
  const bills: Bill[] = Array.isArray(v.bills)
    ? v.bills.slice(0, MAX_LIST).flatMap((b, i): Bill[] => {
        if (!isObject(b) || !isString(b.name)) return [];
        const per = b.per === 'week' || b.per === 'month' || b.per === 'year' ? b.per : null;
        const amount = money(b.amount);
        if (!per || amount == null) return [];
        return [{ id: id(b.id, i), name: b.name.slice(0, MAX_TEXT), amount, per }];
      })
    : [];
  return {
    paySchedule: schedules.find((x) => x === v.paySchedule) ?? DEFAULT_FINANCE.paySchedule,
    federalPct: pct(v.federalPct, 0),
    statePct: pct(v.statePct, 0),
    localPct: pct(v.localPct, 0),
    ficaPct: pct(v.ficaPct, DEFAULT_FINANCE.ficaPct),
    deductions,
    bills,
  };
}

function readDriving(v: unknown): Driving | null {
  if (!isObject(v)) return null;
  const orNull = (x: unknown, max: number) => (inRange(x, 0, max) ? x : null);
  const routes: Route[] = Array.isArray(v.routes)
    ? v.routes.slice(0, MAX_LIST * 4).flatMap((r): Route[] => {
        const trip = readTrip(r);
        return trip && trip.miles != null
          ? [{ from: trip.from, to: trip.to, miles: trip.miles }]
          : [];
      })
    : [];
  return {
    mpg: orNull(v.mpg, 200) || DEFAULT_DRIVING.mpg,
    gasPrice: orNull(v.gasPrice, 100),
    reimbursePerMile: orNull(v.reimbursePerMile, 10),
    routes,
  };
}

function readOvertime(v: unknown): OvertimeRule | null {
  if (!isObject(v)) return null;
  if (v.kind === 'none') return { kind: 'none' };
  if (v.kind === 'weekly' && inRange(v.thresholdHours, 0, 168) && inRange(v.multiplier, 1, 10)) {
    return { kind: 'weekly', thresholdHours: v.thresholdHours, multiplier: v.multiplier };
  }
  return null;
}

/** Each setting's check: the value to keep, or null when it can't be read. */
const SETTING_READERS: { [K in keyof Settings]: (v: unknown) => Settings[K] | null } = {
  name: (v) => (isString(v) ? v.slice(0, MAX_TEXT) : null),
  badge: (v) => (isString(v) ? v.slice(0, MAX_TEXT) : null),
  primaryLocation: (v) => (isString(v) ? v.slice(0, MAX_TEXT) : null),
  requiredHours: (v) => (inRange(v, 0.25, 24) ? v : null),
  locations: readList,
  timeOffTypes: readList,
  theme: (v) => (v === 'system' || v === 'light' || v === 'dark' ? v : null),
  reminderEnabled: (v) => (typeof v === 'boolean' ? v : null),
  reminderLeadMinutes: (v) => (v === 0 || v === 5 || v === 10 || v === 15 ? v : null),
  hourlyRate: (v) => (v === null ? null : inRange(v, 0, 100_000) ? v : null),
  overtime: readOvertime,
  timeOffPay: (v) => {
    if (!isObject(v)) return null;
    const out: Record<string, number> = {};
    for (const [type, rate] of Object.entries(v).slice(0, MAX_LIST)) {
      if (inRange(rate, 0, 10)) out[type.slice(0, MAX_TEXT)] = rate;
    }
    return out;
  },
  usualBreakMinutes: (v) => (isInt(v, 0, 480) ? v : null),
  holidays: (v) =>
    Array.isArray(v)
      ? v
          .slice(0, MAX_HOLIDAYS)
          .map(readHoliday)
          .filter((h): h is HolidayRule => h != null)
      : null,
  autoHolidays: (v) => (typeof v === 'boolean' ? v : null),
  geofencing: (v) => (typeof v === 'boolean' ? v : null),
  places: (v) =>
    Array.isArray(v)
      ? v
          .slice(0, MAX_LIST)
          .filter(
            (p): p is GeoPlace =>
              isObject(p) &&
              isString(p.location) &&
              !!p.location.trim() &&
              inRange(p.latitude, -90, 90) &&
              inRange(p.longitude, -180, 180) &&
              inRange(p.radiusMeters, 50, 5000),
          )
          .map((p) => ({
            location: p.location.slice(0, MAX_TEXT),
            latitude: p.latitude,
            longitude: p.longitude,
            radiusMeters: p.radiusMeters,
          }))
      : null,
  finance: readFinance,
  driving: readDriving,
};

function readClockedSettings(raw: unknown): { settings: Partial<Settings>; skipped: number } {
  const settings: Partial<Settings> = {};
  let skipped = 0;
  if (!isObject(raw)) return { settings, skipped: 1 };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (!(key in raw)) continue;
    const value = SETTING_READERS[key](raw[key]);
    // hourlyRate's "no rate" is null too, so check the raw value for it.
    if (value == null && !(key === 'hourlyRate' && raw[key] === null)) skipped++;
    else (settings as Record<string, unknown>)[key] = value;
  }
  return { settings, skipped };
}

/** The HTML page's settings, under the app's names. */
function readHtmlSettings(raw: unknown): { settings: Partial<Settings>; skipped: number } {
  if (!isObject(raw)) return { settings: {}, skipped: 0 };
  const theme = raw.theme === '' || raw.theme == null ? 'system' : raw.theme;
  return readClockedSettings({
    ...(raw.name !== undefined && { name: raw.name }),
    ...(raw.badge !== undefined && { badge: raw.badge }),
    ...(raw.primaryLoc !== undefined && { primaryLocation: raw.primaryLoc }),
    ...(raw.reqHours !== undefined && { requiredHours: toNumber(raw.reqHours) }),
    ...(raw.locations !== undefined && { locations: raw.locations }),
    ...(raw.offTypes !== undefined && { timeOffTypes: raw.offTypes }),
    theme,
  });
}

// ---------- the whole file ----------

/** Reads a backup file's text: a Clocked backup, or the time card page's data or backup file. */
export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_FILE_CHARS) return { ok: false, message: NOT_A_BACKUP };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: NOT_A_BACKUP };
  }
  if (!isObject(data)) return { ok: false, message: NOT_A_BACKUP };

  if (data.format === BACKUP_FORMAT) {
    if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
      return {
        ok: false,
        message:
          'This backup was made by a newer version of Clocked. Update the app, then try again.',
      };
    }
    if (!Array.isArray(data.entries)) return { ok: false, message: NOT_A_BACKUP };
    const days = collectDays(
      data.entries.map((value) => ({ value })),
      false,
    );
    const { settings, skipped } = readClockedSettings(data.settings);
    return {
      ok: true,
      source: 'clocked',
      exportedAt: isString(data.exportedAt) ? data.exportedAt : undefined,
      ...days,
      settings,
      skippedSettings: skipped,
    };
  }

  // The time card HTML page: { settings, entries: { "YYYY-MM-DD": {...} } }.
  // Its data file also says app: "time-card".
  if (isObject(data.entries)) {
    const days = collectDays(
      Object.entries(data.entries).map(([key, value]) => ({ key, value })),
      true,
    );
    const { settings, skipped } = readHtmlSettings(data.settings);
    return {
      ok: true,
      source: data.app === 'time-card' ? 'html-data' : 'html-backup',
      ...days,
      settings,
      skippedSettings: skipped,
    };
  }

  return { ok: false, message: NOT_A_BACKUP };
}
