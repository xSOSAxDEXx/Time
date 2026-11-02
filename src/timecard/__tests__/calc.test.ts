import {
  allWeeks,
  dayParts,
  isOvernight,
  metMinClockOut,
  minClockOut,
  totalWorked,
  weekStats,
  yearToDate,
} from '../calc';
import { emptyEntry, type Entries, type Entry } from '../types';

// Made-up days only (CLAUDE.md §7: no personal data in tests).
function day(date: string, fields: Partial<Entry> = {}): Entry {
  return { ...emptyEntry(date), ...fields };
}

function entriesOf(...days: Entry[]): Entries {
  return Object.fromEntries(days.map((d) => [d.date, d]));
}

/** A full Monday–Friday week of `hours`-hour days starting at 08:00, no breaks. */
function fullWeek(monday: string, hours = 8): Entry[] {
  const [y, m, d] = monday.split('-').map(Number);
  return Array.from({ length: 5 }, (_, i) => {
    const date = new Date(y, m - 1, d + i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const endMins = 8 * 60 + Math.round(hours * 60);
    const end = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;
    return day(key, { start: '08:00', end });
  });
}

describe('total worked = (End − Start) + Remote + Time off − Break', () => {
  it('a normal day with a break', () => {
    expect(totalWorked(day('2030-01-07', { start: '07:00', end: '16:00', breakHours: 0.5 }))).toBe(
      8.5,
    );
  });

  it('adds remote/outside work and time off', () => {
    const e = day('2030-01-07', {
      start: '12:00',
      end: '16:45',
      timeOffHours: 4,
      remoteHours: 0.5,
      breakHours: 0.25,
    });
    expect(totalWorked(e)).toBeCloseTo(4.75 + 4 + 0.5 - 0.25, 10);
  });

  it('a whole day off with no times is just the time off', () => {
    expect(totalWorked(day('2030-01-07', { timeOffHours: 8, timeOffType: 'PTO' }))).toBe(8);
  });

  it('while the shift is still going, only remote and time off count (no negative break)', () => {
    expect(totalWorked(day('2030-01-07', { start: '08:00', breakHours: 0.25 }))).toBe(0);
    expect(totalWorked(day('2030-01-07', { start: '08:00', remoteHours: 1 }))).toBe(1);
  });

  it('an end before the start is an overnight shift', () => {
    const e = day('2030-01-07', { start: '22:00', end: '06:30', breakHours: 0.5 });
    expect(isOvernight(e)).toBe(true);
    expect(totalWorked(e)).toBe(8);
  });

  it('the same start and end is no time, not 24 hours', () => {
    expect(totalWorked(day('2030-01-07', { start: '08:00', end: '08:00' }))).toBe(0);
  });

  it('an empty day is zero', () => {
    expect(totalWorked(day('2030-01-07'))).toBe(0);
  });
});

describe('min clock out = Start + Required − Time off − Remote + Break', () => {
  it('needs a start time', () => {
    expect(minClockOut(day('2030-01-07'), 8)).toBeNull();
  });

  it('adds the required hours and the break to the start', () => {
    expect(minClockOut(day('2030-01-07', { start: '07:30', breakHours: 0.5 }), 8)).toBe(16);
  });

  it('subtracts time off and remote work', () => {
    const e = day('2030-01-07', { start: '12:00', timeOffHours: 4, remoteHours: 0.5 });
    expect(minClockOut(e, 8)).toBe(15.5);
  });

  it('uses the required hours from settings', () => {
    expect(minClockOut(day('2030-01-07', { start: '09:00' }), 7.5)).toBe(16.5);
  });

  it('is met once the end time reaches it', () => {
    const base = { start: '08:00', breakHours: 0.5 };
    expect(metMinClockOut(day('2030-01-07', { ...base, end: '16:30' }), 8)).toBe(true);
    expect(metMinClockOut(day('2030-01-07', { ...base, end: '16:29' }), 8)).toBe(false);
    expect(metMinClockOut(day('2030-01-07', base), 8)).toBeNull();
  });

  it('runs into the next day for an overnight shift', () => {
    const night = { start: '22:00', breakHours: 0.5 };
    expect(minClockOut(day('2030-01-07', night), 8)).toBe(30.5); // 6:30 AM next day
    expect(metMinClockOut(day('2030-01-07', { ...night, end: '06:30' }), 8)).toBe(true);
    expect(metMinClockOut(day('2030-01-07', { ...night, end: '06:00' }), 8)).toBe(false);
  });
});

describe('day parts for the charts', () => {
  it('splits on site, remote and time off', () => {
    const e = day('2030-01-07', {
      start: '08:00',
      end: '12:00',
      breakHours: 0.5,
      remoteHours: 1,
      timeOffHours: 4,
    });
    expect(dayParts(e)).toEqual({ onSite: 3.5, remote: 1, timeOff: 4 });
  });

  it('never shows negative on-site time', () => {
    expect(dayParts(day('2030-01-07', { breakHours: 0.5 })).onSite).toBe(0);
  });
});

describe('week stats', () => {
  const monday = '2030-01-07';

  it('sums every positive day total, Monday to Sunday', () => {
    const entries = entriesOf(
      ...fullWeek(monday),
      day('2030-01-12', { start: '09:00', end: '11:00' }), // Saturday
      day('2030-01-13', { breakHours: 0.5 }), // a negative day is left out
    );
    const w = weekStats(entries, '2030-01-10');
    expect(w.monday).toBe(monday);
    expect(w.hours).toBe(42);
  });

  it('counts only Monday–Friday days above 0.01 hours as days worked', () => {
    const entries = entriesOf(
      day('2030-01-07', { start: '08:00', end: '16:00' }),
      day('2030-01-08', { timeOffHours: 8 }), // a day off still counts
      day('2030-01-09', { comment: 'nothing logged' }),
      day('2030-01-12', { start: '08:00', end: '16:00' }), // Saturday: hours, not a day
    );
    const w = weekStats(entries, monday);
    expect(w.daysWorked).toBe(2);
    expect(w.hours).toBe(24);
    expect(w.avgPerDay).toBe(12);
    expect(w.timeOffHours).toBe(8);
    expect(w.full).toBe(false);
  });

  it('a full week has 5 days worked', () => {
    expect(weekStats(entriesOf(...fullWeek(monday)), monday).full).toBe(true);
    expect(weekStats(entriesOf(...fullWeek(monday).slice(0, 4)), monday).full).toBe(false);
  });

  it('an empty week has no average', () => {
    expect(weekStats({}, monday)).toMatchObject({ hours: 0, daysWorked: 0, avgPerDay: 0 });
  });
});

describe('all weeks and year to date', () => {
  it('lists every week from the first entry through this week', () => {
    const entries = entriesOf(day('2030-01-08', { start: '08:00', end: '16:00' }));
    const weeks = allWeeks(entries, '2030-01-23');
    expect(weeks.map((w) => w.monday)).toEqual(['2030-01-07', '2030-01-14', '2030-01-21']);
    expect(allWeeks({}, '2030-01-23')).toEqual([]);
  });

  it('ignores days with nothing logged when finding the first week', () => {
    const entries = entriesOf(
      day('2029-06-03'),
      day('2030-01-08', { start: '08:00', end: '16:00' }),
    );
    expect(allWeeks(entries, '2030-01-08')[0].monday).toBe('2030-01-07');
  });

  it('averages full weeks only, and per day is that ÷ 5', () => {
    const entries = entriesOf(
      ...fullWeek('2030-01-07', 8), // 40
      ...fullWeek('2030-01-14', 9), // 45
      ...fullWeek('2030-01-21', 8).slice(0, 3), // partial, left out
    );
    const ytd = yearToDate(entries, '2030-01-23');
    expect(ytd.fullWeeks).toBe(2);
    expect(ytd.avgPerWeek).toBe(42.5);
    expect(ytd.avgPerDay).toBe(8.5);
    expect(ytd.totalHours).toBe(40 + 45 + 24);
  });

  it('only counts weeks that start in the current year', () => {
    const entries = entriesOf(...fullWeek('2029-12-17', 10), ...fullWeek('2030-01-07', 8));
    const ytd = yearToDate(entries, '2030-01-10');
    expect(ytd.fullWeeks).toBe(1);
    expect(ytd.avgPerWeek).toBe(40);
  });

  it('is all zeros with nothing logged', () => {
    expect(yearToDate({}, '2030-01-10')).toEqual({
      avgPerWeek: 0,
      avgPerDay: 0,
      avgWorkedPerWeek: 0,
      fullWeeks: 0,
      totalHours: 0,
    });
  });
});
