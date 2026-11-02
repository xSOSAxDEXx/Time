import { fireEvent, screen } from '@testing-library/react-native';
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

// Made-up days. "Today" is Wednesday 23 Jan 2030.
const day = (date: string, f: Partial<Entry>): Entry => ({ ...emptyEntry(date), ...f });
const shift = (date: string, end = '16:00') => day(date, { start: '08:00', end });
function load(days: Entry[]) {
  useEntries.setState({ entries: Object.fromEntries(days.map((d) => [d.date, d])) });
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2030, 0, 23, 12, 0) });
  useEntries.setState({ entries: {} });
  useSettings.getState().replaceAll({ holidays: [] });
  useWeekView.getState().setMonday('2030-01-21');
});
afterEach(() => jest.useRealTimers());

async function open() {
  await renderRouter(routes, { initialUrl: '/summary' });
  return screen.findByRole('header', { name: 'Summary' });
}

describe('summary', () => {
  it('says what to do when nothing is logged', async () => {
    await open();
    expect(screen.getByText(/Nothing logged yet/)).toBeOnTheScreen();
  });

  it('shows the year’s averages from full weeks, with and without time off', async () => {
    load([
      // Week of Jan 7: full, 41 h (one PTO day)
      shift('2030-01-07', '17:00'),
      shift('2030-01-08'),
      day('2030-01-09', { timeOffHours: 8, timeOffType: 'PTO' }),
      shift('2030-01-10'),
      shift('2030-01-11'),
      // Week of Jan 14: partial, 3 days
      shift('2030-01-14'),
      shift('2030-01-15'),
      shift('2030-01-16'),
      // This week, clocked in today
      shift('2030-01-21'),
      day('2030-01-23', { start: '08:00' }),
    ]);
    await open();
    expect(
      screen.getByLabelText('Avg hours / week this year: 41.00: 1 full week'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Avg hours / day this year: 8.20: Week average ÷ 5'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Avg hours worked / week: 33.00: Without paid time off'),
    ).toBeOnTheScreen();
    // Today's shift is still going, so only Monday counts so far.
    expect(screen.getByLabelText('This week: 8.00: 32.00 h to 40 h')).toBeOnTheScreen();
    expect(
      screen.getByLabelText("Today's min clock out: 4:00 PM: 4.00 h so far · 4:00 left"),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Total logged this year: 73.00: Hours')).toBeOnTheScreen();
    expect(screen.getByText(/1 week this year has fewer than 5 days logged/)).toBeOnTheScreen();
  });

  it('lists every week, newest first, with its status', async () => {
    load([shift('2030-01-08'), shift('2030-01-22')]);
    await open();
    const weeks = screen.getAllByLabelText(/^Week of/).map((w) => w.props.accessibilityLabel);
    expect(weeks).toHaveLength(3);
    expect(weeks[0]).toMatch(/^Week of Jan 21 – 27, 2030\. 1 days worked, 8\.00 hours.*Current$/);
    expect(weeks[2]).toMatch(/^Week of Jan 7 – 13, 2030.*Partial \(1 day\)$/);
  });

  it('opens a week on the Week tab', async () => {
    load([shift('2030-01-08'), shift('2030-01-22')]);
    await open();
    await fireEvent.press(screen.getByLabelText(/^Week of Jan 7/));
    expect(
      await screen.findByRole('header', { name: 'Week of · Jan 7 – 13, 2030' }),
    ).toBeOnTheScreen();
  });

  it('counts company holidays automatically', async () => {
    useSettings.getState().replaceAll({
      holidays: [{ kind: 'fixed', id: 'h', name: 'Test Day', month: 1, day: 10, observed: true }],
    });
    load(['2030-01-07', '2030-01-08', '2030-01-09', '2030-01-11'].map((d) => shift(d)));
    await open();
    expect(
      screen.getByLabelText('Avg hours / week this year: 40.00: 1 full week'),
    ).toBeOnTheScreen();
  });
});
