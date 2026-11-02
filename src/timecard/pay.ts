/**
 * The pay estimate (CLAUDE.md §3.9). Pure functions, like calc.ts. Always
 * shown as "Estimated pay": before taxes, not an official pay stub.
 *
 * - Hours worked (on site + remote) are paid at the hourly rate.
 * - Overtime is weekly (Monday–Sunday). Only hours worked count toward the
 *   threshold. Hours past it are overtime in the order they were worked, so
 *   a range that cuts a week in two (a month, a custom range) gets the same
 *   pay for each day as the whole week does.
 * - Time off is paid per type: not paid, regular or 1.5× (Settings). Types
 *   not listed, or none, are paid at the regular rate.
 */
import { dayParts, entryFor } from './calc';
import { addDays, formatHours, mondayOf, weekDates } from './dates';
import type { DateKey, Entries } from './types';

export type PayRule = {
  /** Null hides pay everywhere. */
  hourlyRate: number | null;
  overtime: { kind: 'none' } | { kind: 'weekly'; thresholdHours: number; multiplier: number };
  timeOffPay: Record<string, number>;
};

export type Pay = {
  regularHours: number;
  overtimeHours: number;
  /** Paid time off hours (types not paid are left out). */
  paidTimeOffHours: number;
  regularPay: number;
  overtimePay: number;
  timeOffPay: number;
  total: number;
};

const ZERO: Pay = {
  regularHours: 0,
  overtimeHours: 0,
  paidTimeOffHours: 0,
  regularPay: 0,
  overtimePay: 0,
  timeOffPay: 0,
  total: 0,
};

export function addPay(a: Pay, b: Pay): Pay {
  return {
    regularHours: a.regularHours + b.regularHours,
    overtimeHours: a.overtimeHours + b.overtimeHours,
    paidTimeOffHours: a.paidTimeOffHours + b.paidTimeOffHours,
    regularPay: a.regularPay + b.regularPay,
    overtimePay: a.overtimePay + b.overtimePay,
    timeOffPay: a.timeOffPay + b.timeOffPay,
    total: a.total + b.total,
  };
}

/** Whether pay is shown at all. */
export function showsPay(rule: PayRule): rule is PayRule & { hourlyRate: number } {
  return rule.hourlyRate != null && rule.hourlyRate > 0;
}

/** Each day of the week containing `monday`, with its share of the week's pay. */
export function weekDayPays(entries: Entries, monday: DateKey, rule: PayRule): Map<DateKey, Pay> {
  const out = new Map<DateKey, Pay>();
  const rate = rule.hourlyRate ?? 0;
  const threshold = rule.overtime.kind === 'weekly' ? rule.overtime.thresholdHours : Infinity;
  const multiplier = rule.overtime.kind === 'weekly' ? rule.overtime.multiplier : 1;
  let workedSoFar = 0;
  for (const date of weekDates(monday)) {
    const e = entryFor(entries, date);
    const { onSite, remote, timeOff } = dayParts(e);
    const worked = onSite + remote;
    const regularHours = Math.max(0, Math.min(worked, threshold - workedSoFar));
    const overtimeHours = worked - regularHours;
    workedSoFar += worked;
    const offRate = e.timeOffType ? (rule.timeOffPay[e.timeOffType] ?? 1) : 1;
    const paidTimeOffHours = offRate > 0 ? timeOff : 0;
    const regularPay = regularHours * rate;
    const overtimePay = overtimeHours * rate * multiplier;
    const timeOffPay = timeOff * rate * offRate;
    out.set(date, {
      regularHours,
      overtimeHours,
      paidTimeOffHours,
      regularPay,
      overtimePay,
      timeOffPay,
      total: regularPay + overtimePay + timeOffPay,
    });
  }
  return out;
}

/** The estimate for the whole week containing `monday`. */
export function weekPay(entries: Entries, monday: DateKey, rule: PayRule): Pay {
  return [...weekDayPays(entries, monday, rule).values()].reduce(addPay, ZERO);
}

/** The estimate for the dates from `from` to `to` (each week's overtime still counts by week). */
export function rangePay(entries: Entries, from: DateKey, to: DateKey, rule: PayRule): Pay {
  let total = ZERO;
  for (let monday = mondayOf(from); monday <= to; monday = addDays(monday, 7)) {
    for (const [date, pay] of weekDayPays(entries, monday, rule)) {
      if (date >= from && date <= to) total = addPay(total, pay);
    }
  }
  return total;
}

/** "$1,234.56". */
export function formatMoney(amount: number): string {
  const cents = Math.round(amount * 100);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}`;
}

/** What went into a pay estimate, e.g. "40.00 h regular · 5.00 h overtime · 8.00 h paid time off". */
export function payBreakdown(pay: Pay): string {
  return [
    `${formatHours(pay.regularHours)} h regular`,
    pay.overtimeHours ? `${formatHours(pay.overtimeHours)} h overtime` : '',
    pay.paidTimeOffHours ? `${formatHours(pay.paidTimeOffHours)} h paid time off` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The note that always goes with an estimate. */
export const PAY_NOTE = 'Before taxes. Not an official pay stub.';
