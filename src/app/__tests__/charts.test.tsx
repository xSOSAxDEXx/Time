import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { useEntries } from '@/store/entries';
import { useSettings } from '@/store/settings';
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
function load(days: Entry[]) {
  useEntries.setState({ entries: Object.fromEntries(days.map((d) => [d.date, d])) });
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2030, 0, 23, 12, 0) });
  useEntries.setState({ entries: {} });
  useSettings.getState().replaceAll({ holidays: [] });
});
afterEach(() => jest.useRealTimers());

async function open() {
  await renderRouter(routes, { initialUrl: '/charts' });
  await screen.findByRole('header', { name: 'Charts' });
  // Columns are drawn once the chart knows its width.
  for (const id of ['chart: Hours per day', 'chart: Hours per week']) {
    await act(async () =>
      fireEvent(screen.getByTestId(id), 'layout', {
        nativeEvent: { layout: { width: 600, height: 240, x: 0, y: 0 } },
      }),
    );
  }
}

describe('charts', () => {
  beforeEach(() =>
    load([
      day('2030-01-14', { start: '08:00', end: '16:00' }),
      day('2030-01-21', { start: '08:00', end: '17:00', breakHours: 0.5, remoteHours: 1 }),
      day('2030-01-22', { timeOffHours: 8, timeOffType: 'PTO' }),
    ]),
  );

  it('shows this week by default, with a summary and one column per day', async () => {
    await open();
    expect(screen.getByLabelText('Range: Jan 21, 2030 – Jan 27, 2030')).toBeOnTheScreen();
    expect(screen.getByLabelText('Total hours: 17.50')).toBeOnTheScreen();
    expect(screen.getByLabelText('Days worked: 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Avg / day: 8.75')).toBeOnTheScreen();
    expect(screen.getByLabelText('Time off: 8.00 h')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: 'Monday, Jan 21, 2030. 8:00 AM – 5:00 PM · 30 min break. On site 8.50. Remote / outside 1.00. Total 9.50 h',
      }),
    ).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /, 2030\. No hours logged$/ })).toHaveLength(5);
    expect(
      screen.getByRole('button', {
        name: 'Week of Jan 21 – 27, 2030. Hours 17.50. Days worked 2. Avg / day 8.75. Time off 8.00. 22.50 h under target',
      }),
    ).toBeOnTheScreen();
  });

  it('tapping a column shows its breakdown', async () => {
    await open();
    const column = screen.getByRole('button', {
      name: 'Tuesday, Jan 22, 2030. Time off (PTO) 8.00. Total 8.00 h',
    });
    await act(async () => fireEvent.press(column));
    // The breakdown is visual only; screen readers get the column's label.
    const hidden = { includeHiddenElements: true };
    expect(screen.getByText('Time off (PTO)', hidden)).toBeOnTheScreen();
    expect(screen.getByText('Total 8.00 h', hidden)).toBeOnTheScreen();
    await act(async () => fireEvent.press(column));
    expect(screen.queryByText('Time off (PTO)', hidden)).toBeNull();
  });

  it('switches to another range', async () => {
    await open();
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'Last week' })));
    expect(screen.getByLabelText('Range: Jan 14, 2030 – Jan 20, 2030')).toBeOnTheScreen();
    expect(screen.getByLabelText('Total hours: 8.00')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Last week' })).toBeChecked();

    await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'This month' })));
    expect(screen.getByLabelText('Range: Jan 1, 2030 – Jan 31, 2030')).toBeOnTheScreen();
    expect(screen.getByLabelText('Total hours: 25.50')).toBeOnTheScreen();
  });

  it('picks custom dates', async () => {
    const picker = jest.requireMock('@react-native-community/datetimepicker');
    await open();
    await act(async () => fireEvent.press(screen.getByLabelText('From date')));
    await act(async () => picker.__pick(new Date(2030, 0, 14)));
    expect(screen.getByRole('radio', { name: 'Custom' })).toBeChecked();
    expect(screen.getByLabelText('Range: Jan 14, 2030 – Jan 27, 2030')).toBeOnTheScreen();
    expect(screen.getByLabelText('Total hours: 25.50')).toBeOnTheScreen();
  });

  it('counts company holidays like the rest of the app', async () => {
    useSettings.getState().update({
      holidays: [
        { id: 'h1', name: 'Made-up Day', kind: 'fixed', month: 1, day: 23, observed: false },
      ],
    });
    await open();
    expect(screen.getByLabelText('Total hours: 25.50')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /^Wednesday, Jan 23, 2030\. Made-up Day\./ }),
    ).toBeOnTheScreen();
  });
});
