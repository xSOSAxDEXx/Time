import { DEFAULT_DRIVING, DEFAULT_FINANCE, type Driving, type Finance } from '@/store/settings';

import {
  drivingTotals,
  findRoute,
  formatMiles,
  moneyFrom,
  perMonth,
  totalMoney,
  tripMiles,
  yearMoney,
} from '../money';
import type { PayRule } from '../pay';
import { emptyEntry, type Entries, type Entry } from '../types';

// Made-up rates, places and days only (CLAUDE.md §7).
const day = (date: string, f: Partial<Entry> = {}): Entry => ({ ...emptyEntry(date), ...f });
const of = (...days: Entry[]): Entries => Object.fromEntries(days.map((d) => [d.date, d]));

const finance: Finance = {
  ...DEFAULT_FINANCE,
  paySchedule: 'biweekly',
  federalPct: 10,
  statePct: 5,
  localPct: 0,
  ficaPct: 7.65,
  deductions: [
    { id: 'a', name: '401(k)', kind: 'retirement', amount: 5, unit: 'percent', pretax: true },
    { id: 'b', name: 'Health insurance', kind: 'health', amount: 100, unit: 'month', pretax: true },
    { id: 'c', name: 'Roth 401(k)', kind: 'retirement', amount: 2, unit: 'percent', pretax: false },
  ],
  bills: [{ id: 'r', name: 'Rent', amount: 1000, per: 'month' }],
};

const driving: Driving = {
  mpg: 25,
  gasPrice: 3.2,
  reimbursePerMile: 0.7,
  routes: [{ from: 'Main office', to: 'Client site', miles: 20 }],
};

describe('amounts per month', () => {
  it('spreads per-paycheck, weekly and yearly amounts over 12 months', () => {
    expect(perMonth(100, 'paycheck', 'biweekly')).toBeCloseTo((100 * 26) / 12);
    expect(perMonth(100, 'paycheck', 'semimonthly')).toBeCloseTo(200);
    expect(perMonth(50, 'week', 'biweekly')).toBeCloseTo((50 * 52) / 12);
    expect(perMonth(1200, 'year', 'biweekly')).toBeCloseTo(100);
    expect(perMonth(5, 'percent', 'biweekly')).toBe(0);
  });
});

describe('take-home and left over', () => {
  it('before-tax deductions lower income tax; health ones lower Social Security + Medicare too', () => {
    const m = moneyFrom(4000, finance);
    // 401(k) 200 + health 100 + Roth 80.
    expect(m.deductions).toBeCloseTo(380);
    // Income tax on 4000 − 200 − 100 = 3700.
    expect(m.federal).toBeCloseTo(370);
    expect(m.state).toBeCloseTo(185);
    // Social Security + Medicare on 4000 − 100 (401(k) doesn't lower it).
    expect(m.fica).toBeCloseTo(3900 * 0.0765);
    expect(m.taxes).toBeCloseTo(370 + 185 + 298.35);
    expect(m.takeHome).toBeCloseTo(4000 - 853.35 - 380);
    expect(m.bills).toBeCloseTo(1000);
    expect(m.leftOver).toBeCloseTo(m.takeHome - 1000);
  });

  it('a tax can be dollars per paycheck or per month instead of a %', () => {
    const m = moneyFrom(
      4000,
      {
        ...finance,
        federalPct: 150,
        statePct: 60,
        taxUnits: { federal: 'paycheck', state: 'month' },
      },
      0.5,
    );
    // 150 a paycheck, 26 a year, over 12 months; half a month counted.
    expect(m.federal).toBeCloseTo(((150 * 26) / 12) * 0.5);
    expect(m.state).toBeCloseTo(30);
    // The rest are still percentages (health is 100 a month, half counted).
    expect(m.fica).toBeCloseTo(3950 * 0.0765);
  });

  it('a part month gets that share of fixed amounts; gas comes off what is left', () => {
    const m = moneyFrom(2000, finance, 0.5, 12.8);
    expect(m.deductions).toBeCloseTo(100 + 50 + 40);
    expect(m.bills).toBeCloseTo(500);
    expect(m.gas).toBe(12.8);
    expect(m.leftOver).toBeCloseTo(m.takeHome - 500 - 12.8);
  });

  it('left over can go below zero', () => {
    expect(moneyFrom(0, finance).leftOver).toBeLessThan(0);
  });

  it('with nothing set up, only Social Security + Medicare comes off', () => {
    const m = moneyFrom(1000, DEFAULT_FINANCE);
    expect(m.taxes).toBeCloseTo(76.5);
    expect(m.takeHome).toBeCloseTo(923.5);
    expect(m.leftOver).toBeCloseTo(923.5);
  });
});

describe('driving', () => {
  it('finds a route either way round, and a trip can set its own miles', () => {
    expect(findRoute(driving.routes, 'Client site', 'Main office')?.miles).toBe(20);
    expect(tripMiles({ from: 'Client site', to: 'Main office' }, driving.routes)).toBe(20);
    expect(tripMiles({ from: 'Main office', to: 'Client site', miles: 23 }, driving.routes)).toBe(
      23,
    );
    expect(tripMiles({ from: 'Main office', to: 'Vendor' }, driving.routes)).toBeNull();
  });

  it('totals miles, gas and reimbursement for the dates asked', () => {
    const entries = of(
      day('2030-01-07', {
        trips: [
          { from: 'Main office', to: 'Client site' },
          { from: 'Client site', to: 'Main office' },
        ],
      }),
      day('2030-01-08', { trips: [{ from: 'Main office', to: 'Vendor' }] }),
      day('2030-02-01', { trips: [{ from: 'Main office', to: 'Client site' }] }),
    );
    const t = drivingTotals(entries, '2030-01-01', '2030-01-31', driving);
    expect(t).toMatchObject({ trips: 3, miles: 40, unknownTrips: 1 });
    expect(t.gas).toBeCloseTo((40 / 25) * 3.2);
    expect(t.reimbursement).toBeCloseTo(28);
    // No MPG or rate set: no gas or reimbursement.
    expect(drivingTotals(entries, '2030-01-01', '2030-01-31', DEFAULT_DRIVING)).toMatchObject({
      gas: null,
      reimbursement: null,
    });
  });

  it('formats miles', () => {
    expect(formatMiles(1234.56)).toBe('1,234.6 mi');
    expect(formatMiles(20)).toBe('20 mi');
  });
});

describe('a year by month', () => {
  const rule: PayRule = { hourlyRate: 20, overtime: { kind: 'none' }, timeOffPay: {} };
  const entries = of(
    day('2030-01-07', { start: '08:00', end: '16:00' }),
    day('2030-01-08', {
      start: '08:00',
      end: '16:00',
      trips: [{ from: 'Main office', to: 'Client site' }],
    }),
  );

  it('counts from the first logged day to today, with that share of the fixed amounts', () => {
    const months = yearMoney(entries, 2030, '2030-01-15', rule, finance, driving);
    expect(months).toHaveLength(12);
    const jan = months[0];
    expect(jan.month).toBe('2030-01');
    // Jan 7–15: 9 of 31 days.
    expect(jan.share).toBeCloseTo(9 / 31);
    expect(jan.money!.gross).toBeCloseTo(320);
    expect(jan.money!.bills).toBeCloseTo((1000 * 9) / 31);
    expect(jan.money!.gas).toBeCloseTo((20 / 25) * 3.2);
    expect(jan.driving).toMatchObject({ trips: 1, miles: 20 });
    // Still to come.
    expect(months[1].money).toBeNull();

    const year = totalMoney(months);
    expect(year.money.gross).toBeCloseTo(320);
    expect(year.driving.miles).toBe(20);
    expect(year.driving.reimbursement).toBeCloseTo(14);
  });

  it('a year before anything was logged has nothing to count', () => {
    expect(
      yearMoney(entries, 2029, '2030-01-15', rule, finance, driving).every((m) => !m.money),
    ).toBe(true);
  });
});
