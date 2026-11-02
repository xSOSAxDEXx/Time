/**
 * When the clock-out reminder fires and what it says (CLAUDE.md §3.8). Pure,
 * so it's tested on its own; the schedulers (native and web) only act on it.
 */
import { isInProgress, minClockOut } from '@/timecard/calc';
import { clockOutDate } from '@/timecard/clock';
import { formatClock, fromKey } from '@/timecard/dates';
import type { DateKey, Entries } from '@/timecard/types';

export type ReminderOptions = {
  enabled: boolean;
  /** Minutes before min clock out (0, 5, 10 or 15). */
  leadMinutes: number;
  requiredHours: number;
  usualBreakHours: number;
};

export type ReminderPlan = {
  /** The day whose shift is open (yesterday's, for an overnight shift). */
  date: DateKey;
  /** Min clock out as a moment in time. */
  minOut: Date;
  /** When to remind: min clock out, less the lead time. */
  fireAt: Date;
  title: string;
  body: string;
  /** Changes whenever the reminder needs rescheduling. */
  key: string;
};

/** "8 hours", "7.5 hours", "1 hour". */
export function hoursPhrase(hours: number): string {
  const n = Math.round(hours * 100) / 100;
  return `${n} ${n === 1 ? 'hour' : 'hours'}`;
}

/**
 * The reminder for the open shift, or null when there's nothing to remind
 * about (reminder off, not clocked in, or already clocked out). The plan is
 * returned even when its time has passed; the schedulers decide what that
 * means (the phone skips it, the web shows the banner).
 */
export function reminderPlan(
  entries: Entries,
  today: DateKey,
  options: ReminderOptions,
): ReminderPlan | null {
  if (!options.enabled) return null;
  const date = clockOutDate(entries, today);
  const entry = entries[date];
  if (!entry || !isInProgress(entry)) return null;
  const min = minClockOut(entry, options.requiredHours, options.usualBreakHours);
  if (min == null) return null;

  const day = fromKey(date);
  // Minutes past midnight of the shift's day; past 24 h rolls into the next day.
  const minOut = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    0,
    Math.round(min * 60),
  );
  const fireAt = new Date(minOut.getTime() - options.leadMinutes * 60_000);
  const hours = hoursPhrase(options.requiredHours);
  const body =
    options.leadMinutes > 0
      ? `${options.leadMinutes} minutes until you hit your ${hours}. Min clock out is ${formatClock(min)}.`
      : `You've hit your ${hours}. You can clock out.`;
  return {
    date,
    minOut,
    fireAt,
    title: options.leadMinutes > 0 ? 'Almost time to clock out' : 'Time to clock out',
    body,
    key: `${date}@${fireAt.getTime()}`,
  };
}
