import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { useReminderState } from '@/notifications/useReminder';
import { useEntries } from '@/store/entries';
import { useSettings } from '@/store/settings';
import { useWeekView } from '@/store/weekView';
import { emptyEntry } from '@/timecard/types';

import WeekScreen from '../(tabs)/index';
import SettingsScreen from '../(tabs)/settings';
import TabsLayout from '../(tabs)/_layout';

const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': WeekScreen,
  '(tabs)/settings': SettingsScreen,
};

const notifications = jest.requireMock('expo-notifications') as {
  __scheduled: Map<string, { content: { title: string; body: string }; trigger: { date: Date } }>;
  __setPermission: (p: string, askAnswer?: string) => void;
};
const reminder = () => notifications.__scheduled.get('clocked-clock-out');
const flush = () => act(async () => {});

// Wednesday 9 Jan 2030, 8:00 AM (made-up dates only).
beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2030, 0, 9, 8, 0) });
  useEntries.setState({ entries: {} });
  useSettings.getState().replaceAll({ holidays: [] });
  useWeekView.getState().setMonday('2030-01-07');
  useReminderState.setState({ permission: null, dismissedKey: null });
  notifications.__scheduled.clear();
  notifications.__setPermission('undetermined');
});
afterEach(() => jest.useRealTimers());

async function openWeek() {
  await renderRouter(routes, { initialUrl: '/' });
  await screen.findByRole('header', { name: /week/ });
  await flush();
}
const press = (name: string | RegExp) =>
  act(async () => fireEvent.press(screen.getByRole('button', { name })));

describe('clock-out reminder', () => {
  it('asks the first time it’s needed, then schedules for min clock out', async () => {
    await openWeek();
    expect(screen.queryByText(/Get a reminder/)).toBeNull();
    await press('Clock in now');
    expect(screen.getByText('Get a reminder when you can clock out?')).toBeOnTheScreen();
    expect(screen.getByText(/at your min clock out \(4:00 PM\)/)).toBeOnTheScreen();
    expect(reminder()).toBeUndefined();

    await press('Allow notifications');
    await flush();
    expect(screen.queryByText(/Get a reminder/)).toBeNull();
    expect(reminder()!.trigger.date).toEqual(new Date(2030, 0, 9, 16, 0));
    expect(reminder()!.content).toEqual({
      title: 'Time to clock out',
      body: "You've hit your 8 hours. You can clock out.",
    });
  });

  it('moves with the day and is cancelled on clock out or clearing the day', async () => {
    notifications.__setPermission('granted');
    await openWeek();
    await press('Clock in now');
    await flush();
    expect(reminder()!.trigger.date).toEqual(new Date(2030, 0, 9, 16, 0));

    await act(async () =>
      useEntries.getState().updateDay('2030-01-09', { breakHours: 0.5, remoteHours: 1 }),
    );
    await flush();
    expect(reminder()!.trigger.date).toEqual(new Date(2030, 0, 9, 15, 30));

    await act(async () => useEntries.getState().clearDay('2030-01-09'));
    await flush();
    expect(reminder()).toBeUndefined();

    await press('Clock in now');
    await flush();
    expect(reminder()).toBeDefined();
    await press('Clock out now');
    await flush();
    expect(reminder()).toBeUndefined();
  });

  it('can remind early, or be turned off', async () => {
    notifications.__setPermission('granted');
    useSettings.getState().update({ reminderLeadMinutes: 15 });
    await openWeek();
    await press('Clock in now');
    await flush();
    expect(reminder()!.trigger.date).toEqual(new Date(2030, 0, 9, 15, 45));
    await act(async () => useSettings.getState().update({ reminderEnabled: false }));
    await flush();
    expect(reminder()).toBeUndefined();
  });

  it('"Not now" turns the reminder off', async () => {
    await openWeek();
    await press('Clock in now');
    await press('Not now');
    await flush();
    expect(useSettings.getState().reminderEnabled).toBe(false);
    expect(screen.queryByText(/Get a reminder/)).toBeNull();
    expect(reminder()).toBeUndefined();
  });

  it('doesn’t schedule a time that has already passed', async () => {
    notifications.__setPermission('granted');
    useEntries.setState({
      entries: { '2030-01-09': { ...emptyEntry('2030-01-09'), start: '00:00' } },
    });
    await openWeek();
    expect(reminder()).toBeUndefined();
  });

  it('settings say when notifications are turned off on the phone', async () => {
    notifications.__setPermission('denied');
    await renderRouter(routes, { initialUrl: '/settings' });
    await screen.findByRole('header', { name: 'Clock-out reminder' });
    await flush();
    expect(
      screen.getByText(/Notifications are turned off for Clocked in your phone's settings/),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open phone settings' })).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('radio', { name: '10 min early' })));
    expect(useSettings.getState().reminderLeadMinutes).toBe(10);
  });
});
