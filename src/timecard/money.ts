/**
 * Take-home pay, bills and driving (CLAUDE.md §3.12–3.13). Pure functions,
 * like pay.ts. Everything here is an estimate from the rates in Settings:
 * not a pay stub and not tax advice.
 *
 * For each month:
 * - Gross = the pay estimate for the days in it (pay.ts).
 * - Taxes are a % of pay, or a fixed amount per paycheck or month (spread
 *   like the deductions below).
 * - Before-tax deductions lower the pay income tax is worked out on; health
 *   ones (not retirement) also lower the pay Social Security + Medicare is on.
 * - Take-home = gross − taxes − every deduction.
 * - Left over = take-home − bills − gas for the month's trips and daily
 *   commute (5 days a week). With a partner included, their take-home is
 *   added and their bills taken off too.
 * - Amounts per paycheck, week or year are spread evenly over the months.
 *   A month only partly covered (before the first logged day, or after
 *   today) gets that share of the fixed amounts, so the current month isn't
 *   charged a whole month of bills against half a month of pay.
 */
import type {
  Bill,
  Deduction,
  Driving,
  Finance,
  Partner,
  PaySchedule,
  Route,
  TaxKey,
} from '@/store/settings';

import { addDays, fromKey, toKey } from './dates';
import { formatMoney, rangePay, type PayRule } from './pay';
import { isEmptyEntry, type DateKey, type Entries, type Trip } from './types';

export const PAYCHECKS_PER_YEAR: Record<PaySchedule, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

const PER_YEAR: Record<Bill['per'], number> = { week: 52, month: 12, year: 1 };

/** A fixed deduction or bill, per month. */
export function perMonth(
  amount: number,
  unit: Deduction['unit'] | Bill['per'],
  schedule: PaySchedule,
): number {
  if (unit === 'percent') return 0;
  if (unit === 'paycheck') return (amount * PAYCHECKS_PER_YEAR[schedule]) / 12;
  return (amount * PER_YEAR[unit]) / 12;
}

// ---------- driving ----------

const samePair = (r: Route, from: string, to: string) =>
  (r.from === from && r.to === to) || (r.from === to && r.to === from);

/** The saved route between two places (either way round), if there is one. */
export function findRoute(routes: Route[], from: string, to: string): Route | undefined {
  return routes.find((r) => samePair(r, from, to));
}

/** A trip's miles: its own, or its route's. Null when neither is known. */
export function tripMiles(trip: Trip, routes: Route[]): number | null {
  return trip.miles ?? findRoute(routes, trip.from, trip.to)?.miles ?? null;
}

export type DrivingTotals = {
  trips: number;
  /** Miles of logged trips (not the commute). */
  miles: number;
  /** Daily commute miles for the days, at 5 days a week. */
  commuteMiles: number;
  /** Trips with no miles yet (no route saved). */
  unknownTrips: number;
  /** Gas for the trips and the commute. Null when MPG or gas price isn't set. */
  gas: number | null;
  /** For the trips only. Null when no reimbursement rate is set. */
  reimbursement: number | null;
};

/** Commute days in a week: the daily commute counts 5 days out of 7. */
export const COMMUTE_DAYS_PER_WEEK = 5;

/** Trips, miles, commute, gas and reimbursement for the days from `from` to `to`. */
export function drivingTotals(
  entries: Entries,
  from: DateKey,
  to: DateKey,
  driving: Driving,
): DrivingTotals {
  let trips = 0;
  let miles = 0;
  let unknownTrips = 0;
  for (const e of Object.values(entries)) {
    if (e.date < from || e.date > to) continue;
    for (const t of e.trips ?? []) {
      trips++;
      const m = tripMiles(t, driving.routes);
      if (m == null) unknownTrips++;
      else miles += m;
    }
  }
  const days =
    to < from
      ? 0
      : Math.round((fromKey(addDays(to, 1)).getTime() - fromKey(from).getTime()) / 86_400_000);
  const commuteMiles = ((driving.commuteMiles ?? 0) * days * COMMUTE_DAYS_PER_WEEK) / 7;
  const { gas } = driveCosts(miles + commuteMiles, driving);
  const { reimbursement } = driveCosts(miles, driving);
  return { trips, miles, commuteMiles, unknownTrips, gas, reimbursement };
}

/** Gas and reimbursement for a number of miles. */
export function driveCosts(
  miles: number,
  driving: Driving,
): { gas: number | null; reimbursement: number | null } {
  const { mpg, gasPrice, reimbursePerMile } = driving;
  return {
    gas: mpg && gasPrice != null ? (miles / mpg) * gasPrice : null,
    reimbursement: reimbursePerMile != null ? miles * reimbursePerMile : null,
  };
}

// ---------- money ----------

export type Money = {
  gross: number;
  federal: number;
  state: number;
  local: number;
  fica: number;
  taxes: number;
  /** Every paycheck deduction, before and after tax. */
  deductions: number;
  takeHome: number;
  bills: number;
  gas: number;
  /** A partner's take-home and bills (0 unless they're included). */
  partnerTakeHome: number;
  partnerBills: number;
  /** Take-home (+ partner's) − bills (+ partner's) − gas. Can be negative. */
  leftOver: number;
};

export const NO_MONEY: Money = {
  gross: 0,
  federal: 0,
  state: 0,
  local: 0,
  fica: 0,
  taxes: 0,
  deductions: 0,
  takeHome: 0,
  bills: 0,
  gas: 0,
  partnerTakeHome: 0,
  partnerBills: 0,
  leftOver: 0,
};

export function addMoney(a: Money, b: Money): Money {
  const out = { ...NO_MONEY };
  for (const k of Object.keys(NO_MONEY) as (keyof Money)[]) out[k] = a[k] + b[k];
  return out;
}

const billsPerMonth = (bills: Bill[]) =>
  bills.reduce((sum, b) => sum + perMonth(b.amount, b.per, 'monthly'), 0);

/**
 * Taxes, deductions and what's left from `gross` pay. `share` is the part
 * of a month this covers (0–1), for the fixed amounts; `gas` is the gas
 * cost for the same days. A partner who's included adds their take-home
 * and bills, for that share of the month too.
 */
export function moneyFrom(
  gross: number,
  finance: Finance,
  share = 1,
  gas = 0,
  partner?: Partner,
): Money {
  const amount = (d: Deduction) =>
    d.unit === 'percent'
      ? (gross * d.amount) / 100
      : perMonth(d.amount, d.unit, finance.paySchedule) * share;
  let deductions = 0;
  let beforeIncomeTax = 0;
  let beforeFica = 0;
  for (const d of finance.deductions) {
    const a = amount(d);
    deductions += a;
    if (d.pretax) {
      beforeIncomeTax += a;
      if (d.kind !== 'retirement') beforeFica += a;
    }
  }
  const taxable = Math.max(0, gross - beforeIncomeTax);
  const units = finance.taxUnits ?? {};
  // A % of the pay it's on, or a fixed amount spread like the deductions.
  const tax = (key: TaxKey, value: number, on: number) => {
    const unit = units[key] ?? 'percent';
    return unit === 'percent'
      ? (on * value) / 100
      : perMonth(value, unit, finance.paySchedule) * share;
  };
  const federal = tax('federal', finance.federalPct, taxable);
  const state = tax('state', finance.statePct, taxable);
  const local = tax('local', finance.localPct, taxable);
  const fica = tax('fica', finance.ficaPct, Math.max(0, gross - beforeFica));
  const taxes = federal + state + local + fica;
  const takeHome = gross - taxes - deductions;
  const bills = billsPerMonth(finance.bills) * share;
  const withPartner = !!partner?.enabled;
  const partnerTakeHome = withPartner
    ? perMonth(partner.takeHome, 'paycheck', partner.paySchedule) * share
    : 0;
  const partnerBills = withPartner ? billsPerMonth(partner.bills) * share : 0;
  return {
    gross,
    federal,
    state,
    local,
    fica,
    taxes,
    deductions,
    takeHome,
    bills,
    gas,
    partnerTakeHome,
    partnerBills,
    leftOver: takeHome + partnerTakeHome - bills - partnerBills - gas,
  };
}

/** The first day with anything logged (counted holidays don't count). */
export function firstLoggedDay(entries: Entries): DateKey | undefined {
  let first: DateKey | undefined;
  for (const e of Object.values(entries)) {
    if (!e.holiday && !isEmptyEntry(e) && (!first || e.date < first)) first = e.date;
  }
  return first;
}

export type MonthMoney = {
  /** "2026-03". */
  month: string;
  first: DateKey;
  last: DateKey;
  /** Null for months with nothing to count (before anything was logged, or still to come). */
  money: Money | null;
  driving: DrivingTotals | null;
  /** The part of the month counted (0–1). */
  share: number;
};

const daysIn = (year: number, month0: number) => new Date(year, month0 + 1, 0).getDate();

/**
 * Each month of `year`. Days before the first logged one, and after
 * `today`, aren't counted. `entries` should include counted holidays and
 * cover whole weeks either side of the year (for overtime).
 */
export function yearMoney(
  entries: Entries,
  year: number,
  today: DateKey,
  rule: PayRule,
  finance: Finance,
  driving: Driving,
  /** The first day anything was logged at all (defaults to the first in `entries`). */
  firstLogged: DateKey | undefined = firstLoggedDay(entries),
  partner?: Partner,
): MonthMoney[] {
  return Array.from({ length: 12 }, (_, m) => {
    const first = toKey(new Date(year, m, 1));
    const last = toKey(new Date(year, m, daysIn(year, m)));
    const month = first.slice(0, 7);
    const from = firstLogged && firstLogged > first ? firstLogged : first;
    const to = today < last ? today : last;
    if (!firstLogged || from > to)
      return { month, first, last, money: null, driving: null, share: 0 };
    const counted = Math.round(
      (fromKey(addDays(to, 1)).getTime() - fromKey(from).getTime()) / 86_400_000,
    );
    const share = counted / daysIn(year, m);
    const gross = rangePay(entries, from, to, rule).total;
    const drive = drivingTotals(entries, from, to, driving);
    return {
      month,
      first,
      last,
      money: moneyFrom(gross, finance, share, drive.gas ?? 0, partner),
      driving: drive,
      share,
    };
  });
}

/** The year's totals from its months. */
export function totalMoney(months: MonthMoney[]): { money: Money; driving: DrivingTotals } {
  let money = NO_MONEY;
  const driving: DrivingTotals = {
    trips: 0,
    miles: 0,
    commuteMiles: 0,
    unknownTrips: 0,
    gas: null,
    reimbursement: null,
  };
  for (const m of months) {
    if (m.money) money = addMoney(money, m.money);
    if (m.driving) {
      driving.trips += m.driving.trips;
      driving.miles += m.driving.miles;
      driving.commuteMiles += m.driving.commuteMiles;
      driving.unknownTrips += m.driving.unknownTrips;
      if (m.driving.gas != null) driving.gas = (driving.gas ?? 0) + m.driving.gas;
      if (m.driving.reimbursement != null)
        driving.reimbursement = (driving.reimbursement ?? 0) + m.driving.reimbursement;
    }
  }
  return { money, driving };
}

/** The note that goes with these numbers. */
export const MONEY_NOTE =
  'Estimates from your hours and the rates in Settings. Not a pay stub or tax advice.';

/** "1,234.5 mi". */
export function formatMiles(miles: number): string {
  const tenths = Math.round(miles * 10);
  const whole = String(Math.floor(tenths / 10)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${whole}${tenths % 10 ? `.${tenths % 10}` : ''} mi`;
}

/** "$51,513": whole dollars, for headline numbers (breakdowns keep the cents). */
export function formatDollars(amount: number): string {
  return formatMoney(Math.round(amount)).replace(/\.00$/, '');
}
