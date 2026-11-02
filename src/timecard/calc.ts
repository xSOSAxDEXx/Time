import { addDays, clockToHours, isWeekday, mondayOf, weekDates } from './dates';
import { emptyEntry, isEmptyEntry, type DateKey, type Entries, type Entry } from './types';

/**
 * The owner's spreadsheet formulas (CLAUDE.md §3.2). Everything here is
 * pure and unrounded; round only when displaying.
 */

/** A day counts as worked (Monday–Friday) when its total is above this. */
export const WORKED_DAY_MIN_HOURS = 0.01;

/** More than this many days worked makes a full week. */
export const FULL_WEEK_MIN_DAYS = 5;

/** Hours after midnight of the day's own date that the shift ends. */
function endHours(e: Entry): number | null {
  const start = clockToHours(e.start);
  const end = clockToHours(e.end);
  if (end == null) return null;
  // An end time earlier than the start is the next morning: an overnight shift.
  return start != null && end < start ? end + 24 : end;
}

/** True when the shift runs past midnight into the next day. */
export function isOvernight(e: Entry): boolean {
  const start = clockToHours(e.start);
  const end = clockToHours(e.end);
  return start != null && end != null && end < start;
}

/** True when clocked in but not out yet: the shift is still going. */
export function isInProgress(e: Entry): boolean {
  return !!e.start && !e.end;
}

/** End − Start in hours, or 0 when either is missing. */
function shiftSpan(e: Entry): number {
  const start = clockToHours(e.start);
  const end = endHours(e);
  return start != null && end != null ? end - start : 0;
}

/**
 * Total worked = (End − Start) + Remote + Time off − Break.
 *
 * Two changes from the spreadsheet, approved by the owner:
 * - An end before the start is an overnight shift (the day it started).
 * - While a shift is still going (no end yet), the break isn't subtracted,
 *   so the day never shows a negative total.
 */
export function totalWorked(e: Entry): number {
  const breakHours = isInProgress(e) ? 0 : e.breakHours;
  return shiftSpan(e) + e.remoteHours + e.timeOffHours - breakHours;
}

/**
 * Min clock out = Start + Required hours − Time off − Remote + Break, in
 * hours since midnight of the day's date (above 24 means the next day).
 * Null when there's no start time.
 */
export function minClockOut(e: Entry, requiredHours: number): number | null {
  const start = clockToHours(e.start);
  if (start == null) return null;
  return start + requiredHours - e.timeOffHours - e.remoteHours + e.breakHours;
}

/** Whether the day's end time reaches its min clock out (null until both exist). */
export function metMinClockOut(e: Entry, requiredHours: number): boolean | null {
  const min = minClockOut(e, requiredHours);
  const end = endHours(e);
  if (min == null || end == null) return null;
  return end >= min - 1e-9;
}

/**
 * The day split for the charts (CLAUDE.md §3.5): on site = shift minus break
 * (never below zero), plus remote/outside and time off.
 */
export function dayParts(e: Entry): { onSite: number; remote: number; timeOff: number } {
  return {
    onSite: Math.max(0, shiftSpan(e) - e.breakHours),
    remote: e.remoteHours,
    timeOff: e.timeOffHours,
  };
}

export function entryFor(entries: Entries, date: DateKey): Entry {
  return entries[date] ?? emptyEntry(date);
}

export type WeekStats = {
  monday: DateKey;
  /** Sum of positive day totals, Monday–Sunday. */
  hours: number;
  /** Monday–Friday days with a total above 0.01. */
  daysWorked: number;
  /** Hours ÷ days worked (0 when no days worked). */
  avgPerDay: number;
  timeOffHours: number;
  /** More than 4 days worked. */
  full: boolean;
};

export function weekStats(entries: Entries, anyDayInWeek: DateKey): WeekStats {
  const monday = mondayOf(anyDayInWeek);
  let hours = 0;
  let daysWorked = 0;
  let timeOffHours = 0;
  for (const date of weekDates(monday)) {
    const e = entryFor(entries, date);
    const total = totalWorked(e);
    if (total > 0) hours += total;
    if (isWeekday(date) && total > WORKED_DAY_MIN_HOURS) daysWorked++;
    timeOffHours += e.timeOffHours;
  }
  return {
    monday,
    hours,
    daysWorked,
    avgPerDay: daysWorked ? hours / daysWorked : 0,
    timeOffHours,
    full: daysWorked >= FULL_WEEK_MIN_DAYS,
  };
}

/** Dates that have anything logged, oldest first. */
export function loggedDates(entries: Entries): DateKey[] {
  return Object.values(entries)
    .filter((e) => !isEmptyEntry(e))
    .map((e) => e.date)
    .sort();
}

/**
 * Every week from the first logged day through the later of the last logged
 * day and today, oldest first. Empty when nothing is logged.
 */
export function allWeeks(entries: Entries, today: DateKey): WeekStats[] {
  const dates = loggedDates(entries);
  if (!dates.length) return [];
  const last = dates[dates.length - 1] > today ? dates[dates.length - 1] : today;
  const weeks: WeekStats[] = [];
  for (let m = mondayOf(dates[0]); m <= mondayOf(last); m = addDays(m, 7)) {
    weeks.push(weekStats(entries, m));
  }
  return weeks;
}

export type YearToDate = {
  /** Average hours per week over full weeks only (0 when there are none). */
  avgPerWeek: number;
  /** avgPerWeek ÷ 5. */
  avgPerDay: number;
  fullWeeks: number;
  /** Every positive day total this year. */
  totalHours: number;
};

/**
 * Year-to-date figures for the calendar year `today` falls in. A week belongs
 * to the year its Monday is in (the spreadsheet kept one sheet per year).
 */
export function yearToDate(entries: Entries, today: DateKey): YearToDate {
  const year = today.slice(0, 4);
  const weeks = allWeeks(entries, today).filter((w) => w.monday.startsWith(year));
  const full = weeks.filter((w) => w.full);
  const avgPerWeek = full.length ? full.reduce((sum, w) => sum + w.hours, 0) / full.length : 0;
  return {
    avgPerWeek,
    avgPerDay: avgPerWeek / 5,
    fullWeeks: full.length,
    totalHours: weeks.reduce((sum, w) => sum + w.hours, 0),
  };
}
