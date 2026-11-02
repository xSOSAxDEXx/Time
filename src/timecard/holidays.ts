import { addDays, toKey, weekdayIndex } from './dates';
import type { DateKey } from './types';

/**
 * Company holidays as rules, so they repeat every year without re-entering
 * them (owner request). Weekday numbers here are 0 = Monday ... 6 = Sunday,
 * like the rest of the app; months are 1–12.
 */
export type HolidayRule =
  | {
      kind: 'fixed';
      id: string;
      name: string;
      month: number;
      day: number;
      /** On a Saturday it's taken the Friday before; on a Sunday, the Monday after. */
      observed: boolean;
    }
  | {
      kind: 'weekday';
      id: string;
      name: string;
      month: number;
      weekday: number;
      /** 1–4 for the 1st–4th, or -1 for the last one in the month. */
      nth: number;
      /** Days after that weekday, e.g. 1 for the Friday after Thanksgiving. */
      offsetDays: number;
    };

/** The owner's company holidays (their 2026 list), as rules for every year. */
export const STANDARD_HOLIDAYS: HolidayRule[] = [
  { kind: 'fixed', id: 'new-year', name: "New Year's Day", month: 1, day: 1, observed: true },
  {
    kind: 'weekday',
    id: 'memorial',
    name: 'Memorial Day',
    month: 5,
    weekday: 0,
    nth: -1,
    offsetDays: 0,
  },
  {
    kind: 'fixed',
    id: 'independence',
    name: 'Independence Day',
    month: 7,
    day: 4,
    observed: true,
  },
  { kind: 'weekday', id: 'labor', name: 'Labor Day', month: 9, weekday: 0, nth: 1, offsetDays: 0 },
  {
    kind: 'weekday',
    id: 'thanksgiving',
    name: 'Thanksgiving',
    month: 11,
    weekday: 3,
    nth: 4,
    offsetDays: 0,
  },
  {
    kind: 'weekday',
    id: 'thanksgiving-friday',
    name: 'Day after Thanksgiving',
    month: 11,
    weekday: 3,
    nth: 4,
    offsetDays: 1,
  },
  { kind: 'fixed', id: 'christmas', name: 'Christmas Day', month: 12, day: 25, observed: true },
];

const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const ORDINALS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', [-1]: 'Last' };

/** The date a rule falls on in `year`, or null if the rule doesn't make a real date. */
export function holidayDate(rule: HolidayRule, year: number): DateKey | null {
  if (rule.kind === 'fixed') {
    const key = `${year}-${pad(rule.month)}-${pad(rule.day)}`;
    const d = new Date(year, rule.month - 1, rule.day);
    if (d.getMonth() !== rule.month - 1) return null; // e.g. Feb 30
    if (!rule.observed) return key;
    const wd = weekdayIndex(key);
    return wd === 5 ? addDays(key, -1) : wd === 6 ? addDays(key, 1) : key;
  }
  let key: DateKey;
  if (rule.nth === -1) {
    const last = toKey(new Date(year, rule.month, 0)); // last day of the month
    key = addDays(last, -((weekdayIndex(last) - rule.weekday + 7) % 7));
  } else {
    const first = `${year}-${pad(rule.month)}-01`;
    key = addDays(first, ((rule.weekday - weekdayIndex(first) + 7) % 7) + (rule.nth - 1) * 7);
    if (Number(key.slice(5, 7)) !== rule.month) return null;
  }
  return addDays(key, rule.offsetDays);
}

/**
 * Every holiday date from `from` to `to` (inclusive), date → name. Looks at
 * the years either side too, since an observed day can cross a year (New
 * Year's Day on a Saturday is taken on Friday, December 31).
 */
export function holidaysBetween(
  rules: HolidayRule[],
  from: DateKey,
  to: DateKey,
): Map<DateKey, string> {
  const out = new Map<DateKey, string>();
  const [y1, y2] = [Number(from.slice(0, 4)), Number(to.slice(0, 4))];
  for (let year = y1 - 1; year <= y2 + 1; year++) {
    for (const rule of rules) {
      const date = holidayDate(rule, year);
      if (date && date >= from && date <= to && !out.has(date)) out.set(date, rule.name);
    }
  }
  return out;
}

/** "December 25 (moves off weekends)" or "Last Monday of May" or "Day after the 4th Thursday of November". */
export function describeRule(rule: HolidayRule): string {
  if (rule.kind === 'fixed') {
    return `${MONTHS[rule.month - 1]} ${rule.day}${rule.observed ? ' (moves off weekends)' : ''}`;
  }
  const base = `${ORDINALS[rule.nth]} ${WEEKDAYS[rule.weekday]} of ${MONTHS[rule.month - 1]}`;
  if (rule.offsetDays === 0) return base;
  const after = rule.offsetDays === 1 ? 'Day after' : `${rule.offsetDays} days after`;
  return `${after} the ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
}

export { MONTHS as MONTH_NAMES, WEEKDAYS as WEEKDAY_NAMES };
