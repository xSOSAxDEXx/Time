import { DEFAULT_SETTINGS } from '@/store/settings';
import { emptyEntry, type Entry } from '@/timecard/types';

import { backupFileName, buildBackup, parseBackup } from '../format';

// Made-up days only (CLAUDE.md §7: no personal data in tests).
const day = (date: string, f: Partial<Entry> = {}): Entry => ({ ...emptyEntry(date), ...f });

function parsed(text: string) {
  const r = parseBackup(text);
  if (!r.ok) throw new Error(r.message);
  return r;
}

describe("Punch'd backups", () => {
  it('round-trips every day and setting', () => {
    const entries = {
      '2030-01-08': day('2030-01-08', {
        start: '08:00',
        end: '16:30',
        breakHours: 0.5,
        breaks: [{ start: '11:30', end: '12:00' }],
        clockInPlace: 'Main office',
        clockOutPlace: 'Client site',
        trips: [
          { from: 'Main office', to: 'Client site' },
          { from: 'Client site', to: 'Main office', miles: 21.5 },
        ],
      }),
      '2030-01-07': day('2030-01-07', {
        timeOffHours: 8,
        timeOffType: 'PTO',
        travel: 'No',
        location: 'Main office',
        comment: 'Made-up day, "quoted", with a comma',
      }),
      '2030-01-01': day('2030-01-01', { skipHoliday: true }),
    };
    const settings = {
      ...DEFAULT_SETTINGS,
      name: 'Sample Person',
      hourlyRate: 25,
      usualBreakMinutes: 30,
      usualBreakStart: '11:30',
      geofencing: true,
      places: [
        { location: 'Main office', latitude: 10.002, longitude: 20.002, radiusMeters: 150 },
        {
          location: 'Client site',
          latitude: 10.5,
          longitude: 20.5,
          radiusMeters: 340,
          outline: [
            { latitude: 10.498, longitude: 20.498 },
            { latitude: 10.502, longitude: 20.498 },
            { latitude: 10.502, longitude: 20.502 },
          ],
        },
      ],
      finance: {
        paySchedule: 'weekly' as const,
        federalPct: 9.5,
        statePct: 4,
        localPct: 40,
        ficaPct: 7.65,
        taxUnits: { local: 'paycheck' as const },
        deductions: [
          {
            id: 'd1',
            name: '401(k)',
            kind: 'retirement' as const,
            amount: 6,
            unit: 'percent' as const,
            pretax: true,
          },
        ],
        bills: [{ id: 'b1', name: 'Phone', amount: 60, per: 'month' as const }],
      },
      driving: {
        mpg: 28,
        gasPrice: 3.1,
        reimbursePerMile: 0.5,
        commuteMiles: 24,
        routes: [{ from: 'Main office', to: 'Client site', miles: 20 }],
      },
      partner: {
        enabled: true,
        name: 'Sam',
        takeHome: 1250,
        paySchedule: 'semimonthly' as const,
        bills: [{ id: 'p1', name: 'Gym', amount: 40, per: 'month' as const }],
      },
    };
    const backup = buildBackup(settings, entries, new Date(2030, 0, 9, 12));
    expect(backup.format).toBe('clocked-backup');
    expect(backup.entries.map((e) => e.date)).toEqual(['2030-01-01', '2030-01-07', '2030-01-08']);

    const r = parsed(JSON.stringify(backup));
    expect(r.source).toBe('clocked');
    expect(r.entries).toEqual(entries);
    expect(r.settings).toEqual(settings);
    expect([r.skippedDays, r.repairedDays, r.skippedSettings]).toEqual([0, 0, 0]);
  });

  it('skips unreadable trips, deductions, bills and routes', () => {
    const backup = buildBackup(DEFAULT_SETTINGS, {}, new Date(2030, 0, 9));
    const raw = {
      ...backup,
      entries: [
        {
          ...day('2030-01-08', { start: '08:00' }),
          trips: [{ from: 'Main office', to: 'Vendor', miles: -3 }, { from: '', to: 'Vendor' }, 7],
          breaks: [{ start: '11:30', end: '11:54' }, { start: '25:00', end: '11:00' }, 'noon'],
        },
      ],
      settings: {
        ...backup.settings,
        finance: {
          federalPct: 250,
          statePct: 320,
          localPct: 75,
          taxUnits: { state: 'paycheck', local: 'year' },
          deductions: [
            { name: 'Too much', unit: 'percent', amount: 400 },
            { name: 'Health', kind: 'health', unit: 'paycheck', amount: 80, pretax: true },
          ],
          bills: [{ name: 'Rent', amount: 'lots', per: 'month' }],
        },
        partner: {
          enabled: 'yes',
          takeHome: -5,
          paySchedule: 'daily',
          bills: [
            { name: 'Gym', amount: 40, per: 'day' },
            { name: 'Car', amount: 300, per: 'month' },
          ],
        },
        driving: {
          mpg: -1,
          commuteMiles: -10,
          routes: [
            { from: 'A', to: 'B' },
            { from: 'A', to: 'C', miles: 9 },
          ],
        },
      },
    };
    const r = parsed(JSON.stringify(raw));
    // A trip with bad miles keeps the trip without them; the rest are dropped.
    expect(r.entries['2030-01-08'].trips).toEqual([{ from: 'Main office', to: 'Vendor' }]);
    // Break times that aren't real times are dropped.
    expect(r.entries['2030-01-08'].breaks).toEqual([{ start: '11:30', end: '11:54' }]);
    expect(r.repairedDays).toBe(1);
    expect(r.settings.finance).toMatchObject({
      federalPct: 0,
      // Dollars per paycheck may be over 100; an unknown unit stays a %.
      statePct: 320,
      localPct: 75,
      taxUnits: { state: 'paycheck' },
      ficaPct: 7.65,
      deductions: [{ name: 'Health', kind: 'health', unit: 'paycheck', amount: 80, pretax: true }],
      bills: [],
    });
    expect(r.settings.partner).toEqual({
      enabled: false,
      name: '',
      takeHome: 0,
      paySchedule: 'biweekly',
      bills: [{ id: 'item-1', name: 'Car', amount: 300, per: 'month' }],
    });
    expect(r.settings.driving).toEqual({
      mpg: null,
      gasPrice: null,
      reimbursePerMile: null,
      routes: [{ from: 'A', to: 'C', miles: 9 }],
    });
  });

  it('names the file by the local date', () => {
    expect(backupFileName(new Date(2030, 0, 9, 23, 30))).toBe('punchd-backup-2030-01-09.json');
  });

  it('skips unreadable days, blanks unreadable fields and drops unreadable settings', () => {
    const r = parsed(
      JSON.stringify({
        format: 'clocked-backup',
        version: 1,
        settings: {
          requiredHours: -3,
          theme: 'neon',
          name: 'Sample',
          locations: ['A', ' A ', '', 7, 'B'],
          holidays: [
            { kind: 'fixed', id: 'x', name: 'Made-up Day', month: 2, day: 3, observed: false },
            { kind: 'fixed', id: 'y', name: 'Bad', month: 13, day: 1 },
          ],
          surprise: '<script>',
        },
        entries: [
          day('2030-01-07', { start: '08:00', end: '16:00' }),
          { ...day('2030-01-08', { start: '25:99', end: '16:00' }), remoteHours: 'lots' },
          { date: '2030-02-30', start: '08:00' },
          'not a day',
        ],
      }),
    );
    expect(Object.keys(r.entries)).toEqual(['2030-01-07', '2030-01-08']);
    expect(r.entries['2030-01-08']).toMatchObject({ start: '', end: '16:00', remoteHours: 0 });
    expect(r.skippedDays).toBe(2);
    expect(r.repairedDays).toBe(1);
    expect(r.skippedSettings).toBe(2);
    expect(r.settings).toEqual({
      name: 'Sample',
      locations: ['A', 'B'],
      holidays: [
        { kind: 'fixed', id: 'x', name: 'Made-up Day', month: 2, day: 3, observed: false },
      ],
    });
  });

  it('refuses files from a newer version, and files that are not backups', () => {
    const newer = parseBackup(
      JSON.stringify({ format: 'clocked-backup', version: 2, entries: [] }),
    );
    expect(newer).toMatchObject({ ok: false, message: expect.stringMatching(/newer version/) });
    for (const text of ['', 'not json', '[]', '{"hello":1}', 'null']) {
      expect(parseBackup(text)).toMatchObject({
        ok: false,
        message: expect.stringMatching(/doesn't look like/),
      });
    }
  });
});

describe('the time card HTML page files', () => {
  const html = {
    settings: {
      name: 'Sample Person',
      badge: '000',
      primaryLoc: 'Main office',
      reqHours: 8,
      locations: ['Main office', 'Remote'],
      offTypes: ['PTO', 'Unpaid'],
      theme: '',
    },
    entries: {
      '2030-01-07': {
        date: '2030-01-07',
        start: '07:30',
        end: '16:00',
        brk: 0.5,
        remote: '1.5',
        off: 0,
        offType: '',
        travel: 'Yes',
        loc: 'Main office',
        comment: 'Made-up comment',
      },
      // Older rows may lack a date field, use "8:05" times or be all blank.
      '2030-01-08': { start: '8:05', end: '', brk: '', remote: '', off: '8', offType: 'PTO' },
      '2030-01-09': {
        date: '2030-01-09',
        start: '',
        end: '',
        brk: 0,
        remote: 0,
        off: 0,
        comment: '',
      },
    },
  };

  it("reads the page's Backup file", () => {
    const r = parsed(JSON.stringify(html));
    expect(r.source).toBe('html-backup');
    expect(r.entries).toEqual({
      '2030-01-07': day('2030-01-07', {
        start: '07:30',
        end: '16:00',
        breakHours: 0.5,
        remoteHours: 1.5,
        travel: 'Yes',
        location: 'Main office',
        comment: 'Made-up comment',
      }),
      '2030-01-08': day('2030-01-08', { start: '08:05', timeOffHours: 8, timeOffType: 'PTO' }),
    });
    expect(r.settings).toEqual({
      name: 'Sample Person',
      badge: '000',
      primaryLocation: 'Main office',
      requiredHours: 8,
      locations: ['Main office', 'Remote'],
      timeOffTypes: ['PTO', 'Unpaid'],
      theme: 'system',
    });
  });

  it("reads the page's data file (timecard-data.json)", () => {
    const r = parsed(JSON.stringify({ app: 'time-card', version: 1, savedAt: 'x', ...html }));
    expect(r.source).toBe('html-data');
    expect(Object.keys(r.entries)).toHaveLength(2);
  });
});
