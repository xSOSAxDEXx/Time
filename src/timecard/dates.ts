import type { ClockTime, DateKey } from './types';

/**
 * Local-calendar date helpers. Dates are handled as "YYYY-MM-DD" keys and
 * local midnight Dates, never UTC, so a day never shifts across time zones.
 * Weeks run Monday to Sunday (CLAUDE.md §3.2).
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toKey(fromKey(value)) === value;
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

/** 0 = Monday ... 6 = Sunday. */
export function weekdayIndex(key: DateKey): number {
  return (fromKey(key).getDay() + 6) % 7;
}

export function isWeekday(key: DateKey): boolean {
  return weekdayIndex(key) < 5;
}

/** The Monday that starts the week containing `key`. */
export function mondayOf(key: DateKey): DateKey {
  return addDays(key, -weekdayIndex(key));
}

/** Monday to Sunday of the week starting `monday`. */
export function weekDates(monday: DateKey): DateKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/** "HH:MM" from a Date, for "Clock in now". */
export function clockTimeOf(d: Date): ClockTime {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isClockTime(value: unknown): value is ClockTime {
  if (typeof value !== 'string') return false;
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  return !!m && Number(m[1]) < 24 && Number(m[2]) < 60;
}

/** Hours since midnight ("07:30" → 7.5), or null when not set. */
export function clockToHours(t: ClockTime): number | null {
  if (!isClockTime(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
}

/** Hours since midnight as a 12-hour time: 15.5 → "3:30 PM". Wraps past midnight. */
export function formatClock(hours: number): string {
  let mins = Math.round(hours * 60);
  mins = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Hours to 2 decimals, as the spreadsheet shows them: 8.5 → "8.50". */
export function formatHours(hours: number): string {
  return (Math.round(hours * 100) / 100).toFixed(2);
}

export const minutesToHours = (minutes: number) => minutes / 60;
export const hoursToMinutes = (hours: number) => Math.round(hours * 60);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Jan 7". */
export function formatShortDate(key: DateKey): string {
  const d = fromKey(key);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Monday, Jan 7, 2030". */
export function formatLongDate(key: DateKey): string {
  const d = fromKey(key);
  return `${DAY_NAMES[weekdayIndex(key)]}, ${formatShortDate(key)}, ${d.getFullYear()}`;
}

/** "Jan 7 – 13, 2030", "Jan 28 – Feb 3, 2030" or "Dec 29, 2029 – Jan 4, 2030". */
export function formatWeekRange(monday: DateKey): string {
  const sunday = addDays(monday, 6);
  const [a, b] = [fromKey(monday), fromKey(sunday)];
  if (a.getFullYear() !== b.getFullYear()) {
    return `${formatShortDate(monday)}, ${a.getFullYear()} – ${formatShortDate(sunday)}, ${b.getFullYear()}`;
  }
  const end = a.getMonth() === b.getMonth() ? String(b.getDate()) : formatShortDate(sunday);
  return `${formatShortDate(monday)} – ${end}, ${b.getFullYear()}`;
}

/** A length of time as hours and minutes: 1.0833 → "1:05". */
export function formatDuration(hours: number): string {
  const mins = Math.max(0, Math.round(hours * 60));
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
}
