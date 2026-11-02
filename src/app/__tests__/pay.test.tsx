import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { useEntries } from '@/store/entries';
import { useSettings } from '@/store/settings';
import { useWeekView } from '@/store/weekView';
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

// Made-up days and rate. "Today" is Friday 11 Jan 2030, 6 PM.
const day = (date: string, f: Partial<Entry>): Entry => ({ ...emptyEntry(date), ...f });
const shift = (date: string, end: string) => day(date, { start: '08:00', end });

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2030, 0, 11, 18, 0) });
  useSettings.getState().replaceAll({ holidays: [], hourlyRate: 20 });
  useWeekView.getState().setMonday('2030-01-07');
  // Mon–Thu 10 h days (40 h worked) and 8 h of PTO on Friday: $800 + $160.
  // Saturday 2 h remote is past 40 h worked, so overtime at 1.5×: $60.
  useEntries.setState({
    entries: Object.fromEntries(
      [
        shift('2030-01-07', '18:00'),
        shift('2030-01-08', '18:00'),
        shift('2030-01-09', '18:00'),
        shift('2030-01-10', '18:00'),
        day('2030-01-11', { timeOffHours: 8, timeOffType: 'PTO' }),
        day('2030-01-12', { remoteHours: 2 }),
      ].map((d) => [d.date, d]),
    ),
  });
});
afterEach(() => jest.useRealTimers());

const label =
  'Estimated pay: $1,020.00. 40.00 h regular · 2.00 h overtime · 8.00 h paid time off. Before taxes. Not an official pay stub.';

describe('estimated pay', () => {
  it('shows in the week footer with what went into it', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByLabelText(label)).toBeOnTheScreen();
  });

  it('shows on each week in the All weeks list', async () => {
    await renderRouter(routes, { initialUrl: '/summary' });
    await screen.findByRole('header', { name: 'All weeks' });
    expect(screen.getByText('Estimated pay $1,020.00')).toBeOnTheScreen();
    expect(screen.getByText(/Estimated pay is before taxes/)).toBeOnTheScreen();
  });

  it('shows in the chart range summary', async () => {
    await renderRouter(routes, { initialUrl: '/charts' });
    await screen.findByRole('header', { name: 'Charts' });
    expect(screen.getByLabelText('Estimated pay: $1,020.00')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'Last week' })));
    expect(screen.getByLabelText('Estimated pay: $0.00')).toBeOnTheScreen();
  });

  it('is hidden everywhere without an hourly rate', async () => {
    useSettings.getState().update({ hourlyRate: null });
    await renderRouter(routes, { initialUrl: '/' });
    await screen.findByLabelText(/Week total/);
    expect(screen.queryByText(/Estimated pay/)).toBeNull();
    await act(async () => fireEvent.press(screen.getByLabelText('Summary and all weeks')));
    await screen.findByRole('header', { name: 'All weeks' });
    expect(screen.queryByText(/Estimated pay/)).toBeNull();
  });
});
