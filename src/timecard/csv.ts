/**
 * The spreadsheet export (CLAUDE.md §3.7): the same columns as the time card
 * HTML page's "Export CSV", one row per day for every logged week, Monday to
 * Sunday. Opens in Excel.
 */
import { allWeeks, entryFor, minClockOut, totalWorked } from './calc';
import { clockToHours, DAY_NAMES, formatClock, formatHours, toKey, weekDates } from './dates';
import { isEmptyEntry, type DateKey, type Entries } from './types';

export const CSV_COLUMNS = [
  'Day',
  'Date',
  'Start Shift',
  'End Shift',
  'Min Clock Out',
  'Time on Break (h)',
  'Remote/Outside Work (h)',
  'Time off HRS',
  'Total Time Worked',
  'Time Off Type',
  'Travel',
  'Location',
  'Comment',
] as const;

/** Quotes a value when it holds a comma, quote or line break. */
function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Spreadsheet programs treat a cell starting with = + - @ as a formula.
 * Free text (comments, locations) gets a leading apostrophe so it stays text.
 */
function text(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

const clock = (t: string) => (t ? formatClock(clockToHours(t) ?? 0) : '');
const hours = (h: number) => (h ? formatHours(h) : '');

/**
 * The CSV text, with a byte-order mark and Windows line endings so Excel
 * reads it as UTF-8. `entries` should include counted company holidays.
 */
export function buildCsv(entries: Entries, today: DateKey, requiredHours: number): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const week of allWeeks(entries, today)) {
    weekDates(week.monday).forEach((date, i) => {
      const e = entryFor(entries, date);
      const min = minClockOut(e, requiredHours);
      lines.push(
        [
          DAY_NAMES[i],
          date,
          clock(e.start),
          clock(e.end),
          min != null ? formatClock(min) : '',
          hours(e.breakHours),
          hours(e.remoteHours),
          hours(e.timeOffHours),
          isEmptyEntry(e) ? '' : formatHours(totalWorked(e)),
          text(e.timeOffType),
          e.travel,
          text(e.location),
          text(e.comment),
        ]
          .map(cell)
          .join(','),
      );
    });
  }
  return '\ufeff' + lines.join('\r\n') + '\r\n';
}

/** e.g. "punchd-2026-11-02.csv" (the local date). */
export function csvFileName(now = new Date()): string {
  return `punchd-${toKey(now)}.csv`;
}
