import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { useEntries } from '@/store/entries';
import { DEFAULT_SETTINGS, useSettings } from '@/store/settings';
import { emptyEntry, type Entry } from '@/timecard/types';

import ChartsScreen from '../(tabs)/charts';
import WeekScreen from '../(tabs)/index';
import SettingsScreen from '../(tabs)/settings';
import SummaryScreen from '../(tabs)/summary';
import TabsLayout from '../(tabs)/_layout';

const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': WeekScreen,
  '(tabs)/summary': SummaryScreen,
  '(tabs)/charts': ChartsScreen,
  '(tabs)/settings': SettingsScreen,
};

const fs = jest.requireMock('expo-file-system') as {
  __files: Map<string, string>;
  __setNextPick: (text: string | null) => void;
};
const sharing = jest.requireMock('expo-sharing') as { __shared: unknown[][] };

// Made-up days. "Today" is Wednesday 9 Jan 2030.
const day = (date: string, f: Partial<Entry> = {}): Entry => ({ ...emptyEntry(date), ...f });

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2030, 0, 9, 12, 0) });
  useSettings.getState().replaceAll({ holidays: [] });
  useEntries.setState({
    entries: { '2030-01-07': day('2030-01-07', { start: '08:00', end: '16:00' }) },
  });
  fs.__files.clear();
  sharing.__shared.length = 0;
});
afterEach(() => jest.useRealTimers());

async function open() {
  await renderRouter(routes, { initialUrl: '/settings' });
  await screen.findByRole('header', { name: 'Backup and export' });
}
const press = (name: string | RegExp) =>
  act(async () => fireEvent.press(screen.getByRole('button', { name })));
const lastShared = () => {
  const [uri, options] = sharing.__shared.at(-1) as [string, { mimeType: string }];
  return { uri, mimeType: options.mimeType, text: fs.__files.get(uri) ?? '' };
};

describe('backup and export', () => {
  it('backs up every day and setting to one file, shared from the phone', async () => {
    useSettings.getState().update({ name: 'Sample Person' });
    await open();
    await press('Back up');
    const file = lastShared();
    expect(file.uri).toBe('file:///cache/punchd-backup-2030-01-09.json');
    expect(file.mimeType).toBe('application/json');
    const backup = JSON.parse(file.text);
    expect(backup.entries).toEqual([day('2030-01-07', { start: '08:00', end: '16:00' })]);
    expect(backup.settings.name).toBe('Sample Person');
    expect(screen.getByText(/Backup made with 1 day/)).toBeOnTheScreen();
  });

  it('exports a spreadsheet', async () => {
    await open();
    await press('Export spreadsheet (CSV)');
    const file = lastShared();
    expect(file.uri).toBe('file:///cache/punchd-2030-01-09.csv');
    expect(file.text.split('\r\n')[1]).toBe(
      'Monday,2030-01-07,8:00 AM,4:00 PM,4:00 PM,,,,8.00,,,,',
    );
  });

  it('restores the time card page’s data file after asking', async () => {
    await open();
    fs.__setNextPick(
      JSON.stringify({
        app: 'time-card',
        version: 1,
        settings: { name: 'Sample Person', reqHours: 7.5, offTypes: ['PTO'], theme: 'dark' },
        entries: {
          '2029-12-03': { date: '2029-12-03', start: '07:00', end: '15:30', brk: 0.5 },
          '2029-12-04': { date: '2029-12-04', off: 8, offType: 'PTO' },
        },
      }),
    );
    useSettings.getState().update({ hourlyRate: 20 });
    await press('Restore');
    expect(screen.getByText("Replace what's on this device?")).toBeOnTheScreen();
    expect(
      screen.getByText('Time card page data file. 2 days logged, Dec 3, 2029 – Dec 4, 2029.'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/The 1 day on this device will be replaced/)).toBeOnTheScreen();
    // Nothing changes until it's confirmed.
    expect(Object.keys(useEntries.getState().entries)).toEqual(['2030-01-07']);

    await press('Replace with this file');
    expect(Object.keys(useEntries.getState().entries).sort()).toEqual(['2029-12-03', '2029-12-04']);
    expect(useEntries.getState().entries['2029-12-03']).toMatchObject({ breakHours: 0.5 });
    const s = useSettings.getState();
    expect([s.name, s.requiredHours, s.timeOffTypes, s.theme]).toEqual([
      'Sample Person',
      7.5,
      ['PTO'],
      'dark',
    ]);
    // Settings the page didn't have stay as they were.
    expect(s.hourlyRate).toBe(20);
    expect(s.locations).toEqual(DEFAULT_SETTINGS.locations);
    expect(screen.getByText(/Restored 2 days\./)).toBeOnTheScreen();
  });

  it('changes nothing when the restore is cancelled', async () => {
    await open();
    fs.__setNextPick(
      JSON.stringify({ format: 'clocked-backup', version: 1, settings: {}, entries: [] }),
    );
    await press('Restore');
    expect(screen.getByText(/This device has no days|will be replaced/)).toBeOnTheScreen();
    await press('Cancel');
    expect(screen.queryByText(/Replace what/)).toBeNull();
    expect(Object.keys(useEntries.getState().entries)).toEqual(['2030-01-07']);
  });

  it('says so when the file isn’t a backup, and does nothing when no file is chosen', async () => {
    await open();
    fs.__setNextPick('{"some":"other file"}');
    await press('Restore');
    expect(screen.getByText(/doesn't look like a Punch'd backup/)).toBeOnTheScreen();
    await press('Restore');
    expect(screen.queryByText(/doesn't look like/)).toBeNull();
    expect(screen.queryByText(/Replace what/)).toBeNull();
  });
});
