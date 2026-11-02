import {
  axisStep,
  columnPath,
  dayBars,
  niceMax,
  orderedRange,
  presetRange,
  rangeSummary,
  weekBars,
} from '../charts';
import { emptyEntry, type Entries, type Entry } from '../types';

// Made-up days only (CLAUDE.md §7: no personal data in tests).
function day(date: string, fields: Partial<Entry> = {}): Entry {
  return { ...emptyEntry(date), ...fields };
}
function entriesOf(...days: Entry[]): Entries {
  return Object.fromEntries(days.map((d) => [d.date, d]));
}

// Wednesday 9 Jan 2030.
const TODAY = '2030-01-09';

describe('presetRange', () => {
  it('this week, last week and the last 4 weeks run Monday to Sunday', () => {
    expect(presetRange('week', TODAY)).toEqual({ from: '2030-01-07', to: '2030-01-13' });
    expect(presetRange('lastWeek', TODAY)).toEqual({ from: '2029-12-31', to: '2030-01-06' });
    expect(presetRange('last4', TODAY)).toEqual({ from: '2029-12-17', to: '2030-01-13' });
  });

  it('this month and last month are calendar months, across the year end', () => {
    expect(presetRange('month', TODAY)).toEqual({ from: '2030-01-01', to: '2030-01-31' });
    expect(presetRange('lastMonth', TODAY)).toEqual({ from: '2029-12-01', to: '2029-12-31' });
    expect(presetRange('lastMonth', '2030-03-15')).toEqual({
      from: '2030-02-01',
      to: '2030-02-28',
    });
  });

  it('all time covers every logged week through this week', () => {
    const entries = entriesOf(day('2029-11-14', { remoteHours: 2 }));
    expect(presetRange('all', TODAY, entries)).toEqual({ from: '2029-11-12', to: '2030-01-13' });
    // Nothing logged: just this week.
    expect(presetRange('all', TODAY, {})).toEqual(presetRange('week', TODAY));
  });

  it('custom dates picked backwards are put in order', () => {
    expect(orderedRange('2030-01-20', '2030-01-02')).toEqual({
      from: '2030-01-02',
      to: '2030-01-20',
    });
  });
});

describe('dayBars', () => {
  const entries = entriesOf(
    day('2030-01-07', { start: '08:00', end: '17:00', breakHours: 0.5, remoteHours: 1 }),
    day('2030-01-08', { timeOffHours: 8, timeOffType: 'PTO' }),
    day('2030-01-12', { remoteHours: 2 }),
  );

  it('splits each day into on site, remote and time off', () => {
    const bars = dayBars(entries, presetRange('week', TODAY));
    expect(bars).toHaveLength(7);
    expect(bars[0]).toMatchObject({ onSite: 8.5, remote: 1, timeOff: 0, total: 9.5 });
    expect(bars[1]).toMatchObject({ onSite: 0, remote: 0, timeOff: 8, total: 8 });
    expect(bars[2].total).toBe(0);
  });

  it('long ranges skip empty weekend days but keep weekends with hours', () => {
    const bars = dayBars(entries, { from: '2030-01-01', to: '2030-01-31' });
    const dates = bars.map((b) => b.date);
    expect(dates).toContain('2030-01-12'); // Saturday with remote hours
    expect(dates).not.toContain('2030-01-13'); // empty Sunday
    expect(bars).toHaveLength(23 + 1);
  });

  it('an overnight shift counts on the day it started', () => {
    const bars = dayBars(entriesOf(day('2030-01-07', { start: '22:00', end: '06:00' })), {
      from: '2030-01-07',
      to: '2030-01-08',
    });
    expect(bars.map((b) => b.total)).toEqual([8, 0]);
  });
});

describe('weekBars and rangeSummary', () => {
  const entries = entriesOf(
    day('2030-01-03', { start: '08:00', end: '16:00' }),
    day('2030-01-07', { start: '08:00', end: '16:00' }),
    day('2030-01-08', { start: '08:00', end: '18:00', timeOffHours: 1, timeOffType: 'PTO' }),
    day('2030-01-12', { remoteHours: 3 }),
  );

  it('one column per week that touches the range', () => {
    const weeks = weekBars(entries, { from: '2030-01-03', to: '2030-01-09' });
    expect(weeks.map((w) => [w.monday, w.hours])).toEqual([
      ['2029-12-31', 8],
      ['2030-01-07', 22],
    ]);
  });

  it('sums the range like the week footer: weekend hours count, weekend days do not', () => {
    expect(rangeSummary(entries, presetRange('week', TODAY))).toEqual({
      hours: 22,
      daysWorked: 2,
      avgPerDay: 11,
      timeOffHours: 1,
    });
    expect(rangeSummary({}, presetRange('week', TODAY)).avgPerDay).toBe(0);
  });
});

describe('chart drawing helpers', () => {
  it('rounds the axis up past the tallest value', () => {
    expect(axisStep(10)).toBe(2);
    expect(axisStep(25)).toBe(5);
    expect(axisStep(45)).toBe(10);
    expect(niceMax(8)).toBe(10);
    expect(niceMax(40)).toBe(50);
    expect(niceMax(0)).toBe(2);
  });

  it('draws columns with rounded tops only when asked', () => {
    expect(columnPath(0, 10, 20, 50, false)).toBe('M0,60V10H20V60Z');
    expect(columnPath(0, 10, 20, 50, true)).toBe('M0,60V14Q0,10 4,10H16Q20,10 20,14V60Z');
    expect(columnPath(0, 10, 20, 0, true)).toBe('');
  });
});
