import { buildCsv, CSV_COLUMNS, csvFileName } from '../csv';
import { emptyEntry, type Entries, type Entry } from '../types';

// Made-up days only (CLAUDE.md §7: no personal data in tests).
const day = (date: string, f: Partial<Entry> = {}): Entry => ({ ...emptyEntry(date), ...f });
const of = (...days: Entry[]): Entries => Object.fromEntries(days.map((d) => [d.date, d]));

describe('CSV export', () => {
  const csv = buildCsv(
    of(
      day('2030-01-07', { start: '08:00', end: '16:30', breakHours: 0.5, location: 'Main office' }),
      day('2030-01-08', {
        timeOffHours: 8,
        timeOffType: 'PTO',
        travel: 'No',
        comment: 'Made-up, with "quotes"\nand a new line',
      }),
      day('2030-01-09', { start: '22:00', end: '06:00', comment: '=1+1' }),
    ),
    '2030-01-09',
    8,
  );
  const lines = csv.slice(1).split('\r\n');

  it('starts with a byte-order mark and the HTML page’s columns', () => {
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe(CSV_COLUMNS.join(','));
    expect(lines[0]).toBe(
      'Day,Date,Start Shift,End Shift,Min Clock Out,Time on Break (h),Remote/Outside Work (h),Time off HRS,Total Time Worked,Time Off Type,Travel,Location,Comment',
    );
  });

  it('writes every day of every logged week, Monday to Sunday', () => {
    expect(lines[1]).toBe('Monday,2030-01-07,8:00 AM,4:30 PM,4:30 PM,0.50,,,8.00,,,Main office,');
    expect(lines[2]).toBe(
      'Tuesday,2030-01-08,,,,,,8.00,8.00,PTO,No,,"Made-up, with ""quotes""\nand a new line"',
    );
    expect(lines[3]).toBe("Wednesday,2030-01-09,10:00 PM,6:00 AM,6:00 AM,,,,8.00,,,,'=1+1");
    expect(lines[7]).toBe('Sunday,2030-01-13,,,,,,,,,,,');
    expect(lines).toHaveLength(1 + 7 + 1); // header, one week, trailing line end
  });

  it('is empty apart from the header when nothing is logged', () => {
    expect(buildCsv({}, '2030-01-09', 8)).toBe('﻿' + CSV_COLUMNS.join(',') + '\r\n');
    expect(csvFileName(new Date(2030, 0, 9))).toBe('punchd-2030-01-09.csv');
  });
});
