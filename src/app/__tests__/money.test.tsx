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

  it('adds a partner and the daily commute', async () => {
    const s = useSettings.getState();
    s.update({
      driving: { ...s.driving, commuteMiles: 14 },
      partner: {
        enabled: true,
        name: 'Sam',
        takeHome: 1240,
        paySchedule: 'monthly',
        bills: [{ id: 'g', name: 'Gym', amount: 310, per: 'month' }],
      },
    });
    await renderRouter(routes, { initialUrl: '/money' });
    // Jan 7–11 is 5 of 31 days: $200 of Sam's take-home, $50 of their bills.
    expect(screen.getAllByLabelText("Sam's take-home: $200: Their bills $50")).toHaveLength(2);
    // Commute: 4 days clocked in × 14 mi = 56 mi, plus the 20 mi drive; gas $9.73.
    expect(
      screen.getByLabelText('Miles this month: 76 mi: 1 drive · commute 56 mi (4 days)'),
    ).toBeOnTheScreen();
    // 527.04 + 200 − 161.29 − 50 − 9.73.
    expect(screen.getAllByLabelText('Left over with Sam: $506: Bills $211 · gas $10')).toHaveLength(
      2,
    );
    // The month row reads the combined left over, and miles with the commute.
    expect(
      screen.getByLabelText('January: gross $640, take-home $527, left over with sam $506, 76 mi'),
    ).toBeOnTheScreen();

    // Turned off: just yours again.
    await act(async () =>
      useSettings
        .getState()
        .update({ partner: { ...useSettings.getState().partner, enabled: false } }),
    );
    expect(screen.queryByLabelText(/Sam's take-home/)).toBeNull();
    expect(screen.getAllByLabelText('Left over: $356: Bills $161 · gas $10')).toHaveLength(2);
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

describe('Settings: spouse or partner', () => {
  it('turns on, names them, and adds their pay and a bill', async () => {
    await renderRouter(routes, { initialUrl: '/settings' });
    await act(async () =>
      fireEvent(screen.getByRole('switch', { name: 'Include in Money' }), 'valueChange', true),
    );
    const name = screen.getByLabelText("Spouse or partner's name");
    await act(async () => fireEvent.changeText(name, 'Sam'));
    await act(async () => fireEvent(name, 'blur'));
    const pay = screen.getByLabelText("Sam's take-home pay per paycheck, in dollars");
    await act(async () => fireEvent.changeText(pay, '1500'));
    await act(async () => fireEvent(pay, 'blur'));
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: "Add Phone (Sam's)" })),
    );
    expect(useSettings.getState().partner).toMatchObject({
      enabled: true,
      name: 'Sam',
      takeHome: 1500,
      paySchedule: 'biweekly',
      bills: [{ name: 'Phone', amount: 0, per: 'month' }],
    });
    // Your own bills are separate.
    expect(useSettings.getState().finance.bills).toHaveLength(1);
  });
});

describe('Settings: taxes', () => {
  it('a tax can be dollars per paycheck instead of a %', async () => {
    useSettings.getState().update({ finance: { ...DEFAULT_FINANCE, federalPct: 12 } });
    await renderRouter(routes, { initialUrl: '/settings' });
    expect(screen.getByLabelText('Federal income tax amount, in percent')).toBeOnTheScreen();
    const [perPaycheck] = screen.getAllByRole('radio', { name: '$ per paycheck' });
    await act(async () => fireEvent.press(perPaycheck));
    // A % doesn't turn into dollars, so it starts again at 0.
    expect(useSettings.getState().finance).toMatchObject({
      federalPct: 0,
      taxUnits: { federal: 'paycheck' },
    });
    const field = screen.getByLabelText('Federal income tax amount, in dollars');
    await act(async () => fireEvent.changeText(field, '145.5'));
    await act(async () => fireEvent(field, 'blur'));
    expect(useSettings.getState().finance.federalPct).toBe(145.5);
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
