import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { useEntries } from '@/store/entries';
import { DEFAULT_FINANCE, useSettings } from '@/store/settings';
import { emptyEntry, type Entry } from '@/timecard/types';

import MoneyScreen from '../(tabs)/money';
import SettingsScreen from '../(tabs)/settings';
import TabsLayout from '../(tabs)/_layout';
import DayScreen from '../day/[date]';

const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/money': MoneyScreen,
  '(tabs)/settings': SettingsScreen,
  'day/[date]': DayScreen,
};

// Made-up days, rates, places and bills. "Today" is Friday 11 Jan 2030.
const day = (date: string, f: Partial<Entry>): Entry => ({ ...emptyEntry(date), ...f });
const shift = (date: string, f: Partial<Entry> = {}) =>
  day(date, { start: '08:00', end: '16:00', ...f });

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2030, 0, 11, 18, 0) });
  useSettings.getState().replaceAll({
    holidays: [],
    hourlyRate: 20,
    finance: {
      ...DEFAULT_FINANCE,
      federalPct: 10,
      bills: [{ id: 'r', name: 'Rent', amount: 1000, per: 'month' }],
    },
    driving: {
      mpg: 25,
      gasPrice: 3.2,
      reimbursePerMile: 0.7,
      routes: [{ from: 'Main office', to: 'Client site', miles: 20 }],
    },
  });
  // Mon–Thu, 8 h each at $20: $640 gross.
  useEntries.setState({
    entries: Object.fromEntries(
      [
        shift('2030-01-07'),
        shift('2030-01-08', { trips: [{ from: 'Main office', to: 'Client site' }] }),
        shift('2030-01-09'),
        shift('2030-01-10'),
      ].map((d) => [d.date, d]),
    ),
  });
});
afterEach(() => jest.useRealTimers());

describe('Money tab', () => {
  it('shows gross, take-home and what is left after bills and gas', async () => {
    await renderRouter(routes, { initialUrl: '/money' });
    // Taxes: 10% federal ($64) + 7.65% Social Security and Medicare ($48.96).
    expect(screen.getAllByLabelText('Gross pay: $640')).toHaveLength(2);
    expect(screen.getAllByLabelText('Take-home: $527: Taxes $113 · deductions $0')).toHaveLength(2);
    // Rent for Jan 7–11 (5 of 31 days) is $161.29; gas for 20 mi is $2.56.
    expect(screen.getAllByLabelText('Left over: $363: Bills $161 · gas $3')).toHaveLength(2);
    expect(screen.getByLabelText('Miles this month: 20 mi: 1 drive')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Reimbursement this year: $14: If your employer pays mileage'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('January: gross $640, take-home $527, left over $363, 20 mi'),
    ).toBeOnTheScreen();
    // The month's column has the exact breakdown.
    await act(async () =>
      fireEvent(screen.getByTestId('chart: Pay by month'), 'layout', {
        nativeEvent: { layout: { width: 600, height: 240, x: 0, y: 0 } },
      }),
    );
    expect(
      screen.getByLabelText(
        'January 2030 (so far). Gross pay $640.00. Taxes $112.96. Deductions $0.00. Take-home $527.04. Bills and gas $163.85. Left over $363.19',
      ),
    ).toBeOnTheScreen();
  });

  it('asks for an hourly rate first', async () => {
    useSettings.getState().update({ hourlyRate: null });
    await renderRouter(routes, { initialUrl: '/money' });
    expect(screen.getByText('Add your hourly rate')).toBeOnTheScreen();
  });
});

describe('Settings: finance and driving', () => {
  it('adds a 401(k) and a bill from the shortcuts', async () => {
    useSettings.getState().update({ finance: DEFAULT_FINANCE });
    await renderRouter(routes, { initialUrl: '/settings' });
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Add 401(k)' })));
    const field = screen.getByLabelText('401(k) amount, in percent');
    await act(async () => fireEvent.changeText(field, '6'));
    await act(async () => fireEvent(field, 'blur'));
    expect(useSettings.getState().finance.deductions).toMatchObject([
      { name: '401(k)', kind: 'retirement', unit: 'percent', amount: 6, pretax: true },
    ]);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Add Phone' })));
    expect(useSettings.getState().finance.bills).toMatchObject([
      { name: 'Phone', per: 'month', amount: 0 },
    ]);
  });
});

describe('Day editor: drives', () => {
  it('adds a drive, and typing its miles saves the route for next time', async () => {
    useSettings.getState().update({
      driving: { mpg: null, gasPrice: null, reimbursePerMile: null, routes: [] },
    });
    await renderRouter(routes, { initialUrl: '/day/2030-01-09' });
    await screen.findByRole('header', { name: /2030/ });
    const from = within(screen.getByLabelText('Drive from'));
    await act(async () => fireEvent.press(from.getByRole('radio', { name: 'Main office' })));
    const to = within(screen.getByLabelText('Drive to'));
    await act(async () => fireEvent.press(to.getByRole('radio', { name: 'Vendor' })));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Add drive' })));
    expect(useEntries.getState().entries['2030-01-09']).toMatchObject({
      travel: 'Yes',
      trips: [{ from: 'Main office', to: 'Vendor' }],
    });

    const miles = screen.getByLabelText('Miles from Main office to Vendor, in miles');
    await act(async () => fireEvent.changeText(miles, '12.5'));
    await act(async () => fireEvent(miles, 'blur'));
    expect(useSettings.getState().driving.routes).toEqual([
      { from: 'Main office', to: 'Vendor', miles: 12.5 },
    ]);
    expect(screen.getByText('12.5 mi')).toBeOnTheScreen();
  });
});
