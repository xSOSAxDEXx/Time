import { describeRule, holidayDate, holidaysBetween, STANDARD_HOLIDAYS } from '../holidays';

describe('company holidays', () => {
  it('reproduces the owner’s 2026 holiday list from the rules', () => {
    expect([...holidaysBetween(STANDARD_HOLIDAYS, '2026-01-01', '2026-12-31')]).toEqual([
      ['2026-01-01', "New Year's Day"],
      ['2026-05-25', 'Memorial Day'],
      ['2026-07-03', 'Independence Day'], // the 4th is a Saturday
      ['2026-09-07', 'Labor Day'],
      ['2026-11-26', 'Thanksgiving'],
      ['2026-11-27', 'Day after Thanksgiving'],
      ['2026-12-25', 'Christmas Day'],
    ]);
  });

  it('repeats every year, moving fixed dates off weekends', () => {
    const y2027 = holidaysBetween(STANDARD_HOLIDAYS, '2027-01-01', '2027-12-31');
    expect(y2027.get('2027-07-05')).toBe('Independence Day'); // Sunday → Monday
    expect(y2027.get('2027-12-24')).toBe('Christmas Day'); // Saturday → Friday
    expect(y2027.get('2027-05-31')).toBe('Memorial Day');
    expect(y2027.get('2027-11-25')).toBe('Thanksgiving');
    expect(y2027.get('2027-11-26')).toBe('Day after Thanksgiving');
  });

  it('finds an observed day that falls in the year before', () => {
    // New Year's Day 2028 is a Saturday, taken on Friday 31 Dec 2027.
    expect(holidaysBetween(STANDARD_HOLIDAYS, '2027-12-27', '2028-01-02').get('2027-12-31')).toBe(
      "New Year's Day",
    );
  });

  it('handles dates that don’t exist and unshifted fixed dates', () => {
    expect(
      holidayDate({ kind: 'fixed', id: 'x', name: 'X', month: 2, day: 30, observed: false }, 2030),
    ).toBeNull();
    expect(
      holidayDate({ kind: 'fixed', id: 'x', name: 'X', month: 7, day: 4, observed: false }, 2026),
    ).toBe('2026-07-04');
  });

  it('describes rules in words', () => {
    expect(STANDARD_HOLIDAYS.map(describeRule)).toEqual([
      'January 1 (moves off weekends)',
      'Last Monday of May',
      'July 4 (moves off weekends)',
      '1st Monday of September',
      '4th Thursday of November',
      'Day after the 4th Thursday of November',
      'December 25 (moves off weekends)',
    ]);
  });
});
