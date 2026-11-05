import { buildCsv, CSV_COLUMNS, csvFileName } from '../csv';
import { emptyEntry, type Entries, type Entry } from '../types';

// Made-up days and places only (CLAUDE.md §7: no personal data in tests).
const day = (date: string, f: Partial<Entry> = {}): Entry => ({ ...emptyEntry(date), ...f });
const of = (...days: Entry[]): Entries => Object.fromEntries(days.map((d) => [d.date, d]));

describe('CSV export', () => {
  const csv = buildCsv(
    of(
      day('2030-01-07', {
        start: '08:00',
        end: '16:54',
        clockInPlace: 'Main office',
        clockOutPlace: 'Main office',
        breakHours: 0.4 + 0.5,
        breaks: [
          { start: '11:30', end: '11:54' },
          { start: '14:00', end: '14:30' },
        ],
        location: 'Main office',
        trips: [{ from: 'Main office', to: 'Yard', miles: 12 }],
        travel: 'Yes',
      }),
      day('2030-01-08', {
        timeOffHours: 8,
        timeOffType: 'PTO',
        comment: 'Made-up, with "quotes"\nand a new line',
      }),
      day('2030-01-09', { start: '22:00', end: '06:00', comment: '=1+1' }),
    ),
    '2030-01-09',
    8,
  );
  const lines = csv.slice(1).split('\r\n');

  it('starts with a byte-order mark and plain column names', () => {
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe(
      'Date,Day,Clock in,Arrived at,Clock out,Left from,Break (min),Break times,Remote (hours),Time off (hours),Time off type,Hours worked,Min clock out,Travel,Drives,Location,Comment',
    );
  });

  it('writes where you clocked in and out, and each break’s times', () => {
    expect(lines[1]).toBe(
      '2030-01-07,Monday,8:00 AM,Main office,4:54 PM,Main office,54,11:30 AM – 11:54 AM; 2:00 PM – 2:30 PM,,,,8.00,4:54 PM,Yes,Main office → Yard (12 mi),Main office,',
    );
    expect(lines[2]).toBe(
      '2030-01-08,Tuesday,,,,,,,,8.00,PTO,8.00,,,,,"Made-up, with ""quotes""\nand a new line"',
    );
    // Clocked in by hand: no place. Free text can't become a formula.
    expect(lines[3]).toBe("2030-01-09,Wednesday,10:00 PM,,6:00 AM,,,,,,,8.00,6:00 AM,,,,'=1+1");
    expect(lines[7]).toBe('2030-01-13,Sunday,,,,,,,,,,,,,,,');
  });

  it('adds a total row and a blank line after each week', () => {
    expect(lines[8]).toBe('Week of 2030-01-07,Total,,,,,54,,,8.00,,24.00,,,,,3 days worked');
    expect(lines[9]).toBe('');
    expect(lines).toHaveLength(1 + 7 + 2 + 1); // header, one week, total, blank, line end
  });

  it('is empty apart from the header when nothing is logged', () => {
    expect(buildCsv({}, '2030-01-09', 8)).toBe('﻿' + CSV_COLUMNS.join(',') + '\r\n');
    expect(csvFileName(new Date(2030, 0, 9))).toBe('punchd-2030-01-09.csv');
  });
});
