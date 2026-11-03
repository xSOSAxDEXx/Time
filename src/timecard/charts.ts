/**
 * The numbers behind the Charts tab (CLAUDE.md §3.5), kept as pure functions
 * like calc.ts. Same rules as the time card HTML page's charts.
 */
import {
  dayParts,
  entryFor,
  loggedDates,
  totalWorked,
  WORKED_DAY_MIN_HOURS,
  weekStats,
  type WeekStats,
} from './calc';
import { addDays, isWeekday, mondayOf, toKey, fromKey } from './dates';
import type { DateKey, Entries, Entry } from './types';

export type RangePreset = 'week' | 'lastWeek' | 'last4' | 'month' | 'lastMonth' | 'all' | 'custom';

export const RANGE_PRESETS: { value: Exclude<RangePreset, 'custom'>; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'lastWeek', label: 'Last week' },
  { value: 'last4', label: 'Last 4 weeks' },
  { value: 'month', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'all', label: 'All time' },
];

export type DateRange = { from: DateKey; to: DateKey };

/** The dates a preset covers, as of `today`. "All time" runs over every logged week. */
export function presetRange(
  preset: Exclude<RangePreset, 'custom'>,
  today: DateKey,
  entries: Entries = {},
): DateRange {
  const monday = mondayOf(today);
  const t = fromKey(today);
  const monthStart = (offset: number) => toKey(new Date(t.getFullYear(), t.getMonth() + offset, 1));
  const monthEnd = (offset: number) =>
    toKey(new Date(t.getFullYear(), t.getMonth() + offset + 1, 0));
  switch (preset) {
    case 'week':
      return { from: monday, to: addDays(monday, 6) };
    case 'lastWeek':
      return { from: addDays(monday, -7), to: addDays(monday, -1) };
    case 'last4':
      return { from: addDays(monday, -21), to: addDays(monday, 6) };
    case 'month':
      return { from: monthStart(0), to: monthEnd(0) };
    case 'lastMonth':
      return { from: monthStart(-1), to: monthEnd(-1) };
    case 'all': {
      const dates = loggedDates(entries);
      if (!dates.length) return { from: monday, to: addDays(monday, 6) };
      const last = dates[dates.length - 1] > today ? dates[dates.length - 1] : today;
      return { from: mondayOf(dates[0]), to: addDays(mondayOf(last), 6) };
    }
  }
}

/** A custom range in order, whichever way round the dates were picked. */
export function orderedRange(a: DateKey, b: DateKey): DateRange {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

/** Every date from `from` to `to`, inclusive. */
export function datesBetween(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export type DayBar = {
  date: DateKey;
  entry: Entry;
  onSite: number;
  remote: number;
  timeOff: number;
  /** onSite + remote + timeOff: the column's height. */
  total: number;
};

/** Ranges longer than this skip empty weekend days, so weekdays get the room. */
export const SKIP_EMPTY_WEEKENDS_OVER_DAYS = 14;

/** One stacked column per day (on site / remote / time off). */
export function dayBars(entries: Entries, range: DateRange): DayBar[] {
  const days = datesBetween(range.from, range.to);
  const bars = days.map((date) => {
    const entry = entryFor(entries, date);
    const { onSite, remote, timeOff } = dayParts(entry);
    return { date, entry, onSite, remote, timeOff, total: onSite + remote + timeOff };
  });
  if (days.length <= SKIP_EMPTY_WEEKENDS_OVER_DAYS) return bars;
  return bars.filter((b) => isWeekday(b.date) || b.total > 0);
}

/** One column per week that overlaps the range (whole weeks, Monday–Sunday). */
export function weekBars(entries: Entries, range: DateRange): WeekStats[] {
  const weeks: WeekStats[] = [];
  for (let m = mondayOf(range.from); m <= range.to; m = addDays(m, 7)) {
    weeks.push(weekStats(entries, m));
  }
  return weeks;
}

export type RangeSummary = {
  /** Sum of positive day totals in the range. */
  hours: number;
  /** Monday–Friday days with a total above 0.01. */
  daysWorked: number;
  /** hours ÷ daysWorked (0 when no days worked). */
  avgPerDay: number;
  timeOffHours: number;
};

/** The figures above the charts: same rules as the week footer, over any dates. */
export function rangeSummary(entries: Entries, range: DateRange): RangeSummary {
  let hours = 0;
  let daysWorked = 0;
  let timeOffHours = 0;
  for (const date of datesBetween(range.from, range.to)) {
    const e = entryFor(entries, date);
    const total = totalWorked(e);
    if (total > 0) hours += total;
    if (isWeekday(date) && total > WORKED_DAY_MIN_HOURS) daysWorked++;
    timeOffHours += e.timeOffHours;
  }
  return { hours, daysWorked, avgPerDay: daysWorked ? hours / daysWorked : 0, timeOffHours };
}

/** The axis step for a chart whose tallest value is `max`. */
export function axisStep(max: number): number {
  return max <= 12 ? 2 : max <= 30 ? 5 : 10;
}

/** A round axis top a little above the tallest column or reference line. */
export function niceMax(value: number): number {
  const v = value * 1.08;
  const step = axisStep(v);
  return Math.max(step, Math.ceil(v / step) * step);
}

/**
 * SVG path for a column with 4 px rounded corners at the top (the data end)
 * and a square base. `round` is false for the lower parts of a stack.
 */
export function columnPath(x: number, y: number, w: number, h: number, round: boolean): string {
  if (h <= 0) return '';
  const r = round ? Math.min(4, w / 2, h) : 0;
  const n = (v: number) => Math.round(v * 100) / 100;
  if (!r) return `M${n(x)},${n(y + h)}V${n(y)}H${n(x + w)}V${n(y + h)}Z`;
  return (
    `M${n(x)},${n(y + h)}V${n(y + r)}Q${n(x)},${n(y)} ${n(x + r)},${n(y)}` +
    `H${n(x + w - r)}Q${n(x + w)},${n(y)} ${n(x + w)},${n(y + r)}V${n(y + h)}Z`
  );
}

/** A round step (1, 2 or 5 times a power of ten) giving about four steps up to `max`. */
export function moneyStep(max: number): number {
  const raw = Math.max(1, max / 4);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / pow;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * pow;
}

/** A round axis top for dollar amounts. */
export function niceMoneyMax(value: number): number {
  const v = Math.max(1, value * 1.08);
  const step = moneyStep(v);
  return Math.ceil(v / step) * step;
}

/** "$850", "$1.2k", "$12k": dollars short enough for a chart label. */
export function shortMoney(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a < 1000) return `${sign}$${Math.round(a)}`;
  const k = a / 1000;
  return `${sign}$${k < 10 ? String(Math.round(k * 10) / 10) : String(Math.round(k))}k`;
}
