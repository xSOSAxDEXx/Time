import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { DEFAULT_SETTINGS, useSettings } from '@/store/settings';
import { STANDARD_HOLIDAYS } from '@/timecard/holidays';

import SettingsScreen from '../(tabs)/settings';
import HolidaysScreen from '../holidays';

const routes = { '(tabs)/settings': SettingsScreen, holidays: HolidaysScreen };

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 1, 9, 0) });
  useSettings.getState().replaceAll({});
});
afterEach(() => jest.useRealTimers());

async function open(url = '/settings') {
  await renderRouter(routes, { initialUrl: url });
  return screen.findByRole('header', {
    name: url === '/settings' ? 'Settings' : 'Company holidays',
  });
}

async function type(label: string, text: string) {
  await fireEvent.changeText(screen.getByLabelText(label), text);
  await fireEvent(screen.getByLabelText(label), 'blur');
}

describe('settings', () => {
  it('starts blank about you and saves what you type', async () => {
    await open();
    expect(screen.getByLabelText('Name').props.value).toBe('');
    await type('Name', '  Sam Example ');
    await type('Badge number', '1234');
    expect(useSettings.getState()).toMatchObject({ name: 'Sam Example', badge: '1234' });
  });

  it('changes the required hours and the usual break', async () => {
    await open();
    await type('Required hours per day, in hours', '7.5');
    await type('Usual break, in minutes', '20');
    expect(useSettings.getState()).toMatchObject({ requiredHours: 7.5, usualBreakMinutes: 20 });
    await type('Required hours per day, in hours', '0');
    expect(useSettings.getState().requiredHours).toBe(7.5);
  });

  it('edits the lists', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Vendor' }));
    await fireEvent.changeText(screen.getByLabelText('New location'), 'Warehouse');
    await fireEvent.press(screen.getByRole('button', { name: 'Add location' }));
    await fireEvent.changeText(screen.getByLabelText('New location'), 'warehouse');
    await fireEvent.press(screen.getByRole('button', { name: 'Add location' }));
    expect(useSettings.getState().locations).toEqual([
      'Main office',
      'Remote',
      'Client site',
      'Other',
      'Warehouse',
    ]);
  });

  it('sets pay: rate, overtime and time off pay', async () => {
    await open();
    await type('Hourly rate, in dollars', '25');
    expect(useSettings.getState().hourlyRate).toBe(25);
    await fireEvent.press(screen.getByRole('radio', { name: 'None' }));
    expect(useSettings.getState().overtime).toEqual({ kind: 'none' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Custom' }));
    await type('Overtime after, in hours a week', '45');
    expect(useSettings.getState().overtime).toEqual({
      kind: 'weekly',
      thresholdHours: 45,
      multiplier: 2,
    });
    // PTO is the first time off type, so its choices come first.
    await fireEvent.press(screen.getAllByRole('radio', { name: '1.5× pay' })[0]);
    expect(useSettings.getState().timeOffPay.PTO).toBe(1.5);
    await type('Hourly rate, in dollars', '');
    expect(useSettings.getState().hourlyRate).toBeNull();
  });

  it('switches the theme', async () => {
    await open();
    await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
    expect(useSettings.getState().theme).toBe('dark');
  });

  it('turns automatic holidays off and shows the next holiday', async () => {
    await open();
    expect(
      screen.getByText(/7 holidays, every year · next: Thanksgiving, Nov 26/),
    ).toBeOnTheScreen();
    await fireEvent(screen.getByLabelText('Count holidays automatically'), 'valueChange', false);
    expect(useSettings.getState().autoHolidays).toBe(false);
  });
});

describe('company holidays screen', () => {
  it('lists the standard holidays with this year’s and next year’s dates', async () => {
    await open('/holidays');
    expect(screen.getByText('Independence Day')).toBeOnTheScreen();
    expect(screen.getByText('Fri, Jul 3, 2026 · Mon, Jul 5, 2027')).toBeOnTheScreen();
    expect(screen.getByText('Thu, Nov 26, 2026 · Thu, Nov 25, 2027')).toBeOnTheScreen();
  });

  it('adds a fixed-date holiday and a weekday holiday', async () => {
    await open('/holidays');
    await type('Holiday name', 'Founders Day');
    await fireEvent.press(screen.getByRole('radio', { name: 'Mar' }));
    await type('Day of the month, in day', '15');
    await fireEvent.press(screen.getByRole('button', { name: 'Add holiday' }));
    expect(useSettings.getState().holidays.at(-1)).toMatchObject({
      kind: 'fixed',
      name: 'Founders Day',
      month: 3,
      day: 15,
      observed: true,
    });

    await type('Holiday name', 'Presidents Day');
    await fireEvent.press(screen.getByRole('radio', { name: 'A weekday of the month' }));
    await fireEvent.press(screen.getByRole('radio', { name: '3rd' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Mon' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Feb' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add holiday' }));
    expect(useSettings.getState().holidays.at(-1)).toMatchObject({
      kind: 'weekday',
      name: 'Presidents Day',
      month: 2,
      weekday: 0,
      nth: 3,
      offsetDays: 0,
    });
    expect(screen.getByText('Mon, Feb 16, 2026 · Mon, Feb 15, 2027')).toBeOnTheScreen();
  });

  it('needs a name and a real date', async () => {
    await open('/holidays');
    await fireEvent.press(screen.getByRole('button', { name: 'Add holiday' }));
    expect(screen.getByText('Give the holiday a name.')).toBeOnTheScreen();
    await type('Holiday name', 'Nope');
    await fireEvent.press(screen.getByRole('radio', { name: 'Feb' }));
    await type('Day of the month, in day', '30');
    await fireEvent.press(screen.getByRole('button', { name: 'Add holiday' }));
    expect(screen.getByText("February doesn't have that day.")).toBeOnTheScreen();
    expect(useSettings.getState().holidays).toHaveLength(STANDARD_HOLIDAYS.length);
  });

  it('removes a holiday on a second tap, and resets to the standard list', async () => {
    await open('/holidays');
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Labor Day' }));
    expect(useSettings.getState().holidays).toHaveLength(7);
    await fireEvent.press(screen.getByRole('button', { name: 'Tap again to remove Labor Day' }));
    expect(useSettings.getState().holidays.map((h) => h.name)).not.toContain('Labor Day');

    await fireEvent.press(screen.getByRole('button', { name: 'Reset to the standard holidays' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tap again to reset' }));
    expect(useSettings.getState().holidays).toEqual(DEFAULT_SETTINGS.holidays);
  });
});
