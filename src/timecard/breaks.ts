/**
 * Break times (owner request, 4 Nov 2026): when each break was, e.g.
 * 11:30 AM – 11:54 AM, not just how long. The day's `breakHours` is still
 * the total the spreadsheet formulas use; logging a break time adds its
 * length to it, and removing one takes it off.
 */
import { clockToHours, formatClock, hoursToMinutes, minutesToHours } from './dates';
import type { BreakTime, ClockTime, Entry } from './types';

/** When the usual break starts if none is set: noon. */
export const DEFAULT_USUAL_BREAK_START: ClockTime = '12:00';

/** At most this many break times a day. */
export const MAX_BREAKS = 12;

const pad = (n: number) => String(n).padStart(2, '0');

/** "HH:MM" for minutes since midnight (wraps past midnight). */
function clockOfMinutes(minutes: number): ClockTime {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** A break's length in minutes. One that ends before it starts runs past midnight. */
export function breakMinutes(b: BreakTime): number {
  const s = clockToHours(b.start);
  const e = clockToHours(b.end);
  if (s == null || e == null) return 0;
  const mins = hoursToMinutes(e - s);
  return mins < 0 ? mins + 1440 : mins;
}

/** The usual break as a time: from its start for its length, e.g. 12:00–12:30. */
export function usualBreakTime(start: ClockTime, minutes: number): BreakTime {
  const s = clockToHours(start) ?? clockToHours(DEFAULT_USUAL_BREAK_START)!;
  return { start: clockOfMinutes(s * 60), end: clockOfMinutes(s * 60 + minutes) };
}

/** "11:30 AM – 11:54 AM". */
export function formatBreak(b: BreakTime): string {
  return `${formatClock(clockToHours(b.start) ?? 0)} – ${formatClock(clockToHours(b.end) ?? 0)}`;
}

const byStart = (a: BreakTime, b: BreakTime) => a.start.localeCompare(b.start);

/** The change that logs a break time: listed in order, its length added to the break total. */
export function addBreak(e: Entry, b: BreakTime): Pick<Entry, 'breaks' | 'breakHours'> {
  return {
    breaks: [...(e.breaks ?? []), b].sort(byStart).slice(0, MAX_BREAKS),
    breakHours: e.breakHours + minutesToHours(breakMinutes(b)),
  };
}

/** The change that removes the break time at `index`, taking its length off the total. */
export function removeBreak(e: Entry, index: number): Pick<Entry, 'breaks' | 'breakHours'> {
  const list = e.breaks ?? [];
  const gone = list[index];
  if (!gone) return { breaks: list, breakHours: e.breakHours };
  const left = Math.max(0, e.breakHours - minutesToHours(breakMinutes(gone)));
  return {
    breaks: list.filter((_, i) => i !== index),
    // Rounded to the minute, so taking off what was added lands back on 0.
    breakHours: minutesToHours(hoursToMinutes(left)),
  };
}
