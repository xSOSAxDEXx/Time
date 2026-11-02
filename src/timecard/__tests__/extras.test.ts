import {
  dayWarnings,
  hoursLeft,
  hoursSoFar,
  minClockOut,
  totalWorked,
  weekStats,
  withHolidays,
  yearToDate,
} from '../calc';
import { emptyEntry, type Entry } from '../types';

// Made-up days only.
const day = (date: string, fields: Partial<Entry> = {}): Entry => ({
  ...emptyEntry(date),
  ...fields,
});
const at = (h: number, m = 0, d = 7) => new Date(2030, 0, d, h, m);

describe('usual break', () => {
  it('is added to min clock out while clocked in with no break logged', () => {
    expect(minClockOut(day('2030-01-07', { start: '08:00' }), 8, 1 / 3)).toBeCloseTo(16 + 1 / 3);
  });

  it('gives way to the real break once it is logged', () => {
    expect(minClockOut(day('2030-01-07', { start: '08:00', breakHours: 0.5 }), 8, 1 / 3)).toBe(
      16.5,
    );
  });

  it('isn’t used once the shift has an end', () => {
    expect(minClockOut(day('2030-01-07', { start: '08:00', end: '16:00' }), 8, 1 / 3)).toBe(16);
  });
});

describe('hours so far and time left', () => {
  it('counts from the start to now while clocked in', () => {
    const e = day('2030-01-07', { start: '08:00', breakHours: 0.25 });
    expect(hoursSoFar(e, at(12, 30))).toBe(4.25);
    expect(hoursLeft(e, at(12, 30), 8)).toBe(3.75); // min out 4:15 PM
    expect(hoursLeft(e, at(17, 0), 8)).toBe(0);
  });

  it('includes the usual break in the time left', () => {
    expect(hoursLeft(day('2030-01-07', { start: '08:00' }), at(12), 8, 0.5)).toBe(4.5);
  });

  it('runs past midnight for an overnight shift', () => {
    expect(hoursSoFar(day('2030-01-07', { start: '22:00' }), at(2, 0, 8))).toBe(4);
  });

  it('is null when not clocked in', () => {
    expect(hoursSoFar(day('2030-01-07', { start: '08:00', end: '16:00' }), at(12))).toBeNull();
    expect(hoursLeft(day('2030-01-07'), at(12), 8)).toBeNull();
  });
});

describe('odd days', () => {
  it('flags a time off type with no hours, and hours with no type', () => {
    expect(dayWarnings(day('2030-01-07', { timeOffType: 'PTO' }), '2030-01-07')).toEqual([
      'PTO is set, but with no hours.',
    ]);
    expect(dayWarnings(day('2030-01-07', { timeOffHours: 4 }), '2030-01-07')).toEqual([
      'Time off hours, but no time off type.',
    ]);
  });

  it('flags a day still clocked in from before yesterday', () => {
    const e = day('2030-01-07', { start: '08:00' });
    expect(dayWarnings(e, '2030-01-08')).toEqual([]);
    expect(dayWarnings(e, '2030-01-09')).toEqual([
      'Still clocked in from this day. Missed a clock out?',
    ]);
  });

  it('flags a very long shift and a break as long as the shift', () => {
    expect(dayWarnings(day('2030-01-07', { start: '06:00', end: '23:30' }), '2030-01-08')).toEqual([
      'A 18-hour shift. Is the end time right?',
    ]);
    expect(
      dayWarnings(
        day('2030-01-07', { start: '08:00', end: '08:30', breakHours: 0.5 }),
        '2030-01-08',
      ),
    ).toEqual(['The break is as long as the shift.']);
  });

  it('a normal day is fine', () => {
    expect(
      dayWarnings(
        day('2030-01-07', { start: '08:00', end: '16:30', breakHours: 0.5 }),
        '2030-01-07',
      ),
    ).toEqual([]);
  });
});

describe('worked-only averages', () => {
  it('leaves paid time off out of worked hours', () => {
    const entries = Object.fromEntries(
      [
        day('2030-01-07', { start: '08:00', end: '16:00' }),
        day('2030-01-08', { start: '08:00', end: '16:00', remoteHours: 1 }),
        day('2030-01-09', { timeOffHours: 8, timeOffType: 'PTO' }),
        day('2030-01-10', { start: '08:00', end: '16:00' }),
        day('2030-01-11', { start: '08:00', end: '16:00' }),
      ].map((e) => [e.date, e]),
    );
    expect(weekStats(entries, '2030-01-07')).toMatchObject({ hours: 41, workedHours: 33 });
    expect(yearToDate(entries, '2030-01-11')).toMatchObject({
      avgPerWeek: 41,
      avgWorkedPerWeek: 33,
    });
  });
});

describe('company holidays counted automatically', () => {
  const holidays = new Map([['2030-01-01', "New Year's Day"]]);

  it('fills a holiday with nothing logged as a full day of Company Holiday', () => {
    const e = withHolidays({}, holidays, 8)['2030-01-01'];
    expect(e).toMatchObject({
      timeOffHours: 8,
      timeOffType: 'Company Holiday',
      holiday: "New Year's Day",
    });
    expect(totalWorked(e)).toBe(8);
  });

  it('keeps whatever was logged on the day instead', () => {
    const logged = { '2030-01-01': day('2030-01-01', { start: '08:00', end: '12:00' }) };
    expect(withHolidays(logged, holidays, 8)['2030-01-01']).toBe(logged['2030-01-01']);
    const skipped = { '2030-01-01': day('2030-01-01', { skipHoliday: true }) };
    expect(totalWorked(withHolidays(skipped, holidays, 8)['2030-01-01'])).toBe(0);
  });

  it('makes a holiday week a full week', () => {
    const week = ['2029-12-31', '2030-01-02', '2030-01-03', '2030-01-04'].map((d) =>
      day(d, { start: '08:00', end: '16:00' }),
    );
    const entries = Object.fromEntries(week.map((e) => [e.date, e]));
    expect(weekStats(entries, '2029-12-31').full).toBe(false);
    expect(weekStats(withHolidays(entries, holidays, 8), '2029-12-31').full).toBe(true);
  });
});
