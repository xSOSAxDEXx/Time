import { addDays, clockToHours, fromKey, isWeekday, mondayOf, weekDates } from './dates';
import { emptyEntry, isEmptyEntry, type DateKey, type Entries, type Entry } from './types';
import { holidaysBetween, type HolidayRule } from './holidays';

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
 * The break min clock out uses: the logged break, or while the shift is
 * still going with no break logged yet, the usual break from Settings (so
 * the morning estimate isn't too early).
 */
export function plannedBreak(e: Entry, usualBreakHours = 0): number {
  return isInProgress(e) && !e.breakHours ? usualBreakHours : e.breakHours;
}

/**
 * Min clock out = Start + Required hours − Time off − Remote + Break, in
 * hours since midnight of the day's date (above 24 means the next day).
 * Null when there's no start time.
 */
export function minClockOut(e: Entry, requiredHours: number, usualBreakHours = 0): number | null {
  const start = clockToHours(e.start);
  if (start == null) return null;
  return start + requiredHours - e.timeOffHours - e.remoteHours + plannedBreak(e, usualBreakHours);
}

/** When the shift started, as a Date. */
function startDate(e: Entry): Date | null {
  const start = clockToHours(e.start);
  if (start == null) return null;
  const d = fromKey(e.date);
  d.setMinutes(Math.round(start * 60));
  return d;
}

/**
 * Hours worked so far while clocked in: time since the start, plus remote and
 * time off, minus any break logged so far. Null when not clocked in.
 */
export function hoursSoFar(e: Entry, now: Date): number | null {
  const start = startDate(e);
  if (!isInProgress(e) || !start) return null;
  const elapsed = Math.max(0, (now.getTime() - start.getTime()) / 3_600_000);
  return elapsed + e.remoteHours + e.timeOffHours - e.breakHours;
}

/**
 * Hours left until min clock out while clocked in (0 once reached), or null
 * when not clocked in.
 */
export function hoursLeft(
  e: Entry,
  now: Date,
  requiredHours: number,
  usualBreakHours = 0,
): number | null {
  const min = minClockOut(e, requiredHours, usualBreakHours);
  if (!isInProgress(e) || min == null) return null;
  const minAt = fromKey(e.date);
  minAt.setMinutes(Math.round(min * 60));
  return Math.max(0, (minAt.getTime() - now.getTime()) / 3_600_000);
}

/** A shift longer than this is probably a missed clock out. */
export const LONG_SHIFT_HOURS = 16;

/**
 * Things about a day that look like a mistake (owner-approved check). Each is
 * a short sentence for the screen.
 */
export function dayWarnings(e: Entry, today: string): string[] {
  const out: string[] = [];
  if (e.timeOffType && !e.timeOffHours) out.push(`${e.timeOffType} is set, but with no hours.`);
  if (e.timeOffHours && !e.timeOffType) out.push('Time off hours, but no time off type.');
  if (isInProgress(e) && e.date < addDays(today, -1)) {
    out.push('Still clocked in from this day. Missed a clock out?');
  }
  const span = shiftSpan(e);
  if (e.end && span > LONG_SHIFT_HOURS) {
    out.push(`A ${Math.round(span)}-hour shift. Is the end time right?`);
  }
  if (e.start && e.end && e.breakHours > 0 && e.breakHours >= span) {
    out.push('The break is as long as the shift.');
  }
  return out;
}

/** Whether the day's end time reaches its min clock out (null until both exist). */
export function metMinClockOut(e: Entry, requiredHours: number): boolean | null {
  // Only once there's an end time, so the logged break always applies.
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

/** The time off type holidays are logged as. */
export const HOLIDAY_TIME_OFF_TYPE = 'Company Holiday';

/** The fields a company holiday fills in: a full day of Company Holiday time off. */
export function holidayFields(name: string, requiredHours: number) {
  return { timeOffHours: requiredHours, timeOffType: HOLIDAY_TIME_OFF_TYPE, holiday: name };
}

/**
 * The entries plus the company holidays in `holidays` that have nothing
 * logged (owner request: holidays count without re-entering them). A day
 * marked `skipHoliday` keeps what was logged instead.
 */
export function withHolidays(
  entries: Entries,
  holidays: Map<DateKey, string>,
  requiredHours: number,
): Entries {
  if (!holidays.size) return entries;
  const out = { ...entries };
  for (const [date, name] of holidays) {
    if (!out[date]) out[date] = { ...emptyEntry(date), ...holidayFields(name, requiredHours) };
  }
  return out;
}

/**
 * The entries the screens work from between `from` and `to`: what's logged,
 * plus company holidays counted automatically (when `auto` is on). Holidays
 * before the first logged day are left out, so they never add weeks from
 * before the person started using the app. `holidays` names every holiday
 * in the range, counted or not.
 */
export function timeCard(
  entries: Entries,
  options: { rules: HolidayRule[]; auto: boolean; requiredHours: number },
  from: DateKey,
  to: DateKey,
): { entries: Entries; holidays: Map<DateKey, string> } {
  const holidays = holidaysBetween(options.rules, from, to);
  const first = loggedDates(entries)[0];
  const counted = new Map(
    options.auto && first ? [...holidays].filter(([date]) => date >= first) : [],
  );
  return { entries: withHolidays(entries, counted, options.requiredHours), holidays };
}

export type WeekStats = {
  monday: DateKey;
  /** Sum of positive day totals, Monday–Sunday. */
  hours: number;
  /** Monday–Friday days with a total above 0.01. */
  daysWorked: number;
  /** Hours ÷ days worked (0 when no days worked). */
  avgPerDay: number;
  /** Hours actually worked: on site + remote, without time off. */
  workedHours: number;
  timeOffHours: number;
  /** More than 4 days worked. */
  full: boolean;
};

export function weekStats(entries: Entries, anyDayInWeek: DateKey): WeekStats {
  const monday = mondayOf(anyDayInWeek);
  let hours = 0;
  let daysWorked = 0;
  let timeOffHours = 0;
  let workedHours = 0;
  for (const date of weekDates(monday)) {
    const e = entryFor(entries, date);
    const total = totalWorked(e);
    if (total > 0) hours += total;
    const parts = dayParts(e);
    workedHours += parts.onSite + parts.remote;
    if (isWeekday(date) && total > WORKED_DAY_MIN_HOURS) daysWorked++;
    timeOffHours += e.timeOffHours;
  }
  return {
    monday,
    hours,
    daysWorked,
    avgPerDay: daysWorked ? hours / daysWorked : 0,
    workedHours,
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
  /** Like avgPerWeek, but hours actually worked only (no paid time off). */
  avgWorkedPerWeek: number;
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
  const average = (pick: (w: WeekStats) => number) =>
    full.length ? full.reduce((sum, w) => sum + pick(w), 0) / full.length : 0;
  const avgPerWeek = average((w) => w.hours);
  return {
    avgPerWeek,
    avgPerDay: avgPerWeek / 5,
    avgWorkedPerWeek: average((w) => w.workedHours),
    fullWeeks: full.length,
    totalHours: weeks.reduce((sum, w) => sum + w.hours, 0),
  };
}
