/**
 * The spreadsheet export (CLAUDE.md §3.7), laid out to read easily in Excel
 * (owner request, 5 Nov 2026; it no longer copies the HTML page's columns):
 * one row per day for every logged week, Monday to Sunday, with where arrive
 * and leave clocked you in and out, each break's times, and a total row
 * after each week.
 */
import { formatBreak } from './breaks';
import { allWeeks, entryFor, minClockOut, totalWorked } from './calc';
import { clockToHours, DAY_NAMES, formatClock, formatHours, toKey, weekDates } from './dates';
import { isEmptyEntry, type DateKey, type Entries, type Entry } from './types';

export const CSV_COLUMNS = [
  'Date',
  'Day',
  'Clock in',
  'Arrived at',
  'Clock out',
  'Left from',
  'Break (min)',
  'Break times',
  'Remote (hours)',
  'Time off (hours)',
  'Time off type',
  'Hours worked',
  'Min clock out',
  'Travel',
  'Drives',
  'Location',
  'Comment',
] as const;

/** Quotes a value when it holds a comma, quote or line break. */
function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Spreadsheet programs treat a cell starting with = + - @ as a formula.
 * Free text (comments, places) gets a leading apostrophe so it stays text.
 */
function text(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

const clock = (t: string) => (t ? formatClock(clockToHours(t) ?? 0) : '');
const hours = (h: number) => (h ? formatHours(h) : '');
const minutes = (h: number) => (h ? String(Math.round(h * 60)) : '');

function drives(e: Entry): string {
  return (e.trips ?? [])
    .map((t) => `${t.from} → ${t.to}${t.miles != null ? ` (${t.miles} mi)` : ''}`)
    .join('; ');
}

function dayRow(e: Entry, dayName: string, requiredHours: number): string[] {
  const min = minClockOut(e, requiredHours);
  return [
    e.date,
    dayName,
    clock(e.start),
    e.start ? text(e.clockInPlace ?? '') : '',
    clock(e.end),
    e.end ? text(e.clockOutPlace ?? '') : '',
    minutes(e.breakHours),
    (e.breaks ?? []).map(formatBreak).join('; '),
    hours(e.remoteHours),
    hours(e.timeOffHours),
    text(e.timeOffType),
    isEmptyEntry(e) ? '' : formatHours(totalWorked(e)),
    min != null ? formatClock(min) : '',
    e.travel,
    text(drives(e)),
    text(e.location),
    text(e.comment),
  ];
}

/**
 * The CSV text, with a byte-order mark and Windows line endings so Excel
 * reads it as UTF-8. `entries` should include counted company holidays.
 */
export function buildCsv(entries: Entries, today: DateKey, requiredHours: number): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const week of allWeeks(entries, today)) {
    const days = weekDates(week.monday).map((date) => entryFor(entries, date));
    days.forEach((e, i) => lines.push(dayRow(e, DAY_NAMES[i], requiredHours).map(cell).join(',')));
    const sum = (f: (e: Entry) => number) => days.reduce((n, e) => n + f(e), 0);
    const total: string[] = CSV_COLUMNS.map(() => '');
    total[0] = `Week of ${week.monday}`;
    total[1] = 'Total';
    total[CSV_COLUMNS.indexOf('Break (min)')] = minutes(sum((e) => e.breakHours));
    total[CSV_COLUMNS.indexOf('Remote (hours)')] = hours(sum((e) => e.remoteHours));
    total[CSV_COLUMNS.indexOf('Time off (hours)')] = hours(week.timeOffHours);
    total[CSV_COLUMNS.indexOf('Hours worked')] = formatHours(week.hours);
    total[CSV_COLUMNS.indexOf('Comment')] =
      `${week.daysWorked} ${week.daysWorked === 1 ? 'day' : 'days'} worked`;
    // A blank line after each week keeps the weeks apart.
    lines.push(total.map(cell).join(','), '');
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** e.g. "punchd-2026-11-02.csv" (the local date). */
export function csvFileName(now = new Date()): string {
  return `punchd-${toKey(now)}.csv`;
}
