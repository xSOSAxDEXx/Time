import {
  addDays,
  clockTimeOf,
  clockToHours,
  formatClock,
  formatHours,
  hoursToMinutes,
  isDateKey,
  minutesToHours,
  mondayOf,
  weekDates,
  weekdayIndex,
} from '../dates';

describe('dates', () => {
  it('finds the Monday of any day, with weeks running Monday to Sunday', () => {
    expect(mondayOf('2030-01-07')).toBe('2030-01-07'); // Monday
    expect(mondayOf('2030-01-13')).toBe('2030-01-07'); // Sunday
    expect(mondayOf('2030-01-01')).toBe('2029-12-31'); // across a year
    expect(weekDates('2030-01-07')).toEqual([
      '2030-01-07',
      '2030-01-08',
      '2030-01-09',
      '2030-01-10',
      '2030-01-11',
      '2030-01-12',
      '2030-01-13',
    ]);
    expect(weekdayIndex('2030-01-12')).toBe(5);
  });

  it('adds days across month ends and daylight-saving changes', () => {
    expect(addDays('2030-01-31', 1)).toBe('2030-02-01');
    expect(addDays('2030-03-09', 2)).toBe('2030-03-11');
    expect(addDays('2030-11-02', 7)).toBe('2030-11-09');
  });

  it('validates date keys', () => {
    expect(isDateKey('2030-02-28')).toBe(true);
    expect(isDateKey('2030-02-30')).toBe(false);
    expect(isDateKey('2030-2-3')).toBe(false);
    expect(isDateKey(20300228)).toBe(false);
  });

  it('converts and formats clock times', () => {
    expect(clockToHours('07:30')).toBe(7.5);
    expect(clockToHours('')).toBeNull();
    expect(clockToHours('25:00')).toBeNull();
    expect(formatClock(15.5)).toBe('3:30 PM');
    expect(formatClock(0)).toBe('12:00 AM');
    expect(formatClock(12)).toBe('12:00 PM');
    expect(formatClock(8 + 5 / 60)).toBe('8:05 AM');
    expect(clockTimeOf(new Date(2030, 0, 7, 9, 4))).toBe('09:04');
  });

  it('formats hours to 2 decimals and converts break minutes', () => {
    expect(formatHours(8.5)).toBe('8.50');
    expect(formatHours(40.166666)).toBe('40.17');
    expect(minutesToHours(20)).toBeCloseTo(0.3333, 4);
    expect(hoursToMinutes(0.33)).toBe(20);
  });
});
