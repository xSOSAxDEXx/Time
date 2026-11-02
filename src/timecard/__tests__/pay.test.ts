import { formatMoney, rangePay, showsPay, weekDayPays, weekPay, type PayRule } from '../pay';
import { emptyEntry, type Entries, type Entry } from '../types';

// Made-up days and rates only (CLAUDE.md §7: no personal data in tests).
const day = (date: string, f: Partial<Entry> = {}): Entry => ({ ...emptyEntry(date), ...f });
const of = (...days: Entry[]): Entries => Object.fromEntries(days.map((d) => [d.date, d]));
const rule = (r: Partial<PayRule> = {}): PayRule => ({
  hourlyRate: 20,
  overtime: { kind: 'weekly', thresholdHours: 40, multiplier: 1.5 },
  timeOffPay: { PTO: 1, Floating: 1, 'Company Holiday': 1, Unpaid: 0 },
  ...r,
});
const MON = '2030-01-07';
const shift = (date: string, end: string, f: Partial<Entry> = {}) =>
  day(date, { start: '08:00', end, ...f });

// Mon–Fri 9 h days = 45 h worked (5 h overtime), plus a remote Saturday.
const busyWeek = of(
  shift('2030-01-07', '17:00'),
  shift('2030-01-08', '17:00'),
  shift('2030-01-09', '17:00'),
  shift('2030-01-10', '17:00'),
  shift('2030-01-11', '17:00'),
  day('2030-01-12', { remoteHours: 2 }),
);

describe('weekPay', () => {
  it('pays regular hours, then overtime past 40 hours worked', () => {
    const p = weekPay(busyWeek, MON, rule());
    expect(p.regularHours).toBe(40);
    expect(p.overtimeHours).toBe(7);
    expect(p.regularPay).toBe(800);
    expect(p.overtimePay).toBe(210);
    expect(p.total).toBe(1010);
  });

  it('puts the overtime on the days it was worked, in order', () => {
    const days = weekDayPays(busyWeek, MON, rule());
    expect(days.get('2030-01-10')!.overtimeHours).toBe(0);
    expect(days.get('2030-01-11')).toMatchObject({ regularHours: 4, overtimeHours: 5 });
    expect(days.get('2030-01-12')).toMatchObject({ regularHours: 0, overtimeHours: 2 });
  });

  it('time off is paid by type and never counts toward overtime', () => {
    const entries = of(
      shift('2030-01-07', '17:00'),
      shift('2030-01-08', '17:00'),
      shift('2030-01-09', '17:00'),
      shift('2030-01-10', '17:00'),
      day('2030-01-11', { timeOffHours: 8, timeOffType: 'PTO' }),
    );
    const p = weekPay(entries, MON, rule());
    expect([p.regularHours, p.overtimeHours, p.paidTimeOffHours]).toEqual([36, 0, 8]);
    expect(p.total).toBe(36 * 20 + 8 * 20);

    const unpaid = of(day('2030-01-07', { timeOffHours: 8, timeOffType: 'Unpaid' }));
    expect(weekPay(unpaid, MON, rule()).total).toBe(0);
    const extra = of(day('2030-01-07', { timeOffHours: 8, timeOffType: 'Holiday worked' }));
    expect(weekPay(extra, MON, rule({ timeOffPay: { 'Holiday worked': 1.5 } })).total).toBe(240);
    // A type that isn't listed, or none, is paid at the regular rate.
    expect(weekPay(of(day('2030-01-07', { timeOffHours: 4 })), MON, rule()).total).toBe(80);
  });

  it('can have no overtime, or a custom rule', () => {
    expect(weekPay(busyWeek, MON, rule({ overtime: { kind: 'none' } })).total).toBe(47 * 20);
    const custom = weekPay(
      busyWeek,
      MON,
      rule({ overtime: { kind: 'weekly', thresholdHours: 45, multiplier: 2 } }),
    );
    expect([custom.regularHours, custom.overtimeHours, custom.total]).toEqual([
      45,
      2,
      45 * 20 + 2 * 40,
    ]);
  });

  it('counts remote work as worked, a break as not, and an open shift as nothing yet', () => {
    const entries = of(
      shift('2030-01-07', '16:30', { breakHours: 0.5, remoteHours: 1 }),
      day('2030-01-08', { start: '08:00' }),
    );
    expect(weekPay(entries, MON, rule()).regularHours).toBe(9);
  });
});

describe('rangePay', () => {
  it('a range that cuts a week keeps that week’s overtime on the right days', () => {
    expect(rangePay(busyWeek, '2030-01-11', '2030-01-12', rule()).overtimeHours).toBe(7);
    expect(rangePay(busyWeek, '2030-01-07', '2030-01-10', rule()).overtimeHours).toBe(0);
    const whole = rangePay(busyWeek, '2030-01-01', '2030-01-31', rule());
    expect(whole.total).toBe(weekPay(busyWeek, MON, rule()).total);
  });
});

describe('showing pay', () => {
  it('is hidden without a rate', () => {
    expect(showsPay(rule())).toBe(true);
    expect(showsPay(rule({ hourlyRate: null }))).toBe(false);
  });

  it('formats dollars', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(19.999)).toBe('$20.00');
    expect(formatMoney(1234567.891)).toBe('$1,234,567.89');
  });
});
