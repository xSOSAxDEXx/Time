import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { useEntries } from '@/store/entries';
import { useSettings } from '@/store/settings';

import DayScreen from '../day/[date]';

type FakePicker = { __pick: (d: Date) => void; __cancel: () => void };
const picker = () => jest.requireMock<FakePicker>('@react-native-community/datetimepicker');
const at = (h: number, m: number) => new Date(2030, 0, 7, h, m);

beforeEach(() => {
  useEntries.setState({ entries: {} });
  useSettings.getState().replaceAll({ holidays: [] });
});

async function openDay(date = '2030-01-07') {
  await renderRouter({ 'day/[date]': DayScreen }, { initialUrl: `/day/${date}` });
  return screen.findByRole('header', { name: /2030/ });
}

async function pickTime(label: RegExp, date: Date) {
  await fireEvent.press(screen.getByRole('button', { name: label }));
  await act(async () => picker().__pick(date));
}

describe('day editor', () => {
  it('shows the date and starts empty', async () => {
    await openDay();
    expect(screen.getByRole('header', { name: 'Monday, Jan 7, 2030' })).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Total worked none/)).toBeOnTheScreen();
  });

  it('works out the total and min clock out as times are entered', async () => {
    await openDay();
    await pickTime(/^Start shift/, at(7, 30));
    expect(screen.getByText('Hours so far')).toBeOnTheScreen();
    expect(screen.getByText('3:30 PM')).toBeOnTheScreen(); // 7:30 + 8h

    await fireEvent.changeText(screen.getByLabelText('Break, in minutes'), '30');
    await fireEvent(screen.getByLabelText('Break, in minutes'), 'blur');
    expect(useEntries.getState().entries['2030-01-07'].breakHours).toBe(0.5);
    expect(screen.getByText('4:00 PM')).toBeOnTheScreen();

    await pickTime(/^End shift/, at(16, 15));
    expect(screen.getByText('8.25')).toBeOnTheScreen();
    expect(screen.getByText('✓ Met')).toBeOnTheScreen();
  });

  it('a cancelled picker changes nothing', async () => {
    await openDay();
    await fireEvent.press(screen.getByRole('button', { name: /^Start shift/ }));
    await act(async () => picker().__cancel());
    expect(useEntries.getState().entries).toEqual({});
  });

  it('ignores a break that isn’t a number', async () => {
    await openDay();
    await fireEvent.changeText(screen.getByLabelText('Break, in minutes'), 'abc');
    await fireEvent(screen.getByLabelText('Break, in minutes'), 'blur');
    expect(useEntries.getState().entries).toEqual({});
    expect(screen.getByLabelText('Break, in minutes').props.value).toBe('');
  });

  it('logs a day off with a type', async () => {
    await openDay();
    await fireEvent.changeText(screen.getByLabelText('Time off, in hours'), '8');
    await fireEvent(screen.getByLabelText('Time off, in hours'), 'blur');
    await fireEvent.press(screen.getByRole('radio', { name: 'PTO' }));
    expect(useEntries.getState().entries['2030-01-07']).toMatchObject({
      timeOffHours: 8,
      timeOffType: 'PTO',
    });
    expect(screen.getByText('8.00')).toBeOnTheScreen();
    // Tapping the chosen chip again clears it.
    await fireEvent.press(screen.getByRole('radio', { name: 'PTO' }));
    expect(useEntries.getState().entries['2030-01-07'].timeOffType).toBe('');
  });

  it('notes an overnight shift and shows min clock out on the next day', async () => {
    await openDay();
    await pickTime(/^Start shift/, at(22, 0));
    expect(screen.getByText('Next day')).toBeOnTheScreen();
    await pickTime(/^End shift/, at(6, 0));
    expect(screen.getByText('Overnight shift: ends the next day.')).toBeOnTheScreen();
    expect(screen.getByText('8.00')).toBeOnTheScreen();
  });

  it('saves a comment', async () => {
    await openDay();
    await fireEvent.changeText(screen.getByLabelText('Comment'), 'Training all day');
    await fireEvent(screen.getByLabelText('Comment'), 'blur');
    expect(useEntries.getState().entries['2030-01-07'].comment).toBe('Training all day');
  });

  it('clears the day only on a second tap', async () => {
    useEntries.getState().updateDay('2030-01-07', { start: '08:00', end: '16:00' });
    await openDay();
    await fireEvent.press(screen.getByRole('button', { name: 'Clear day' }));
    expect(useEntries.getState().entries['2030-01-07']).toBeDefined();
    await fireEvent.press(screen.getByRole('button', { name: 'Tap again to clear' }));
    expect(useEntries.getState().entries['2030-01-07']).toBeUndefined();
  });

  it('steps to the next day', async () => {
    await openDay();
    await fireEvent.press(screen.getByRole('button', { name: 'Next day' }));
    expect(await screen.findByRole('header', { name: 'Tuesday, Jan 8, 2030' })).toBeOnTheScreen();
  });

  it("logs a break's times, starting from the usual break, and removes it", async () => {
    useSettings.getState().update({ usualBreakMinutes: 30, usualBreakStart: '11:30' });
    await openDay();
    // The new break starts filled in with the usual break: 11:30 – 12:00.
    await pickTime(/^Break end/, at(11, 54));
    await fireEvent.press(screen.getByRole('button', { name: 'Add break' }));
    expect(useEntries.getState().entries['2030-01-07']).toMatchObject({
      breaks: [{ start: '11:30', end: '11:54' }],
      breakHours: 24 / 60,
    });
    expect(screen.getByText('11:30 AM – 11:54 AM')).toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Remove the break 11:30 AM – 11:54 AM' }),
    );
    expect(useEntries.getState().entries['2030-01-07']).toBeUndefined();
  });

  it('handles a bad date in the link', async () => {
    await renderRouter({ 'day/[date]': DayScreen }, { initialUrl: '/day/2030-02-31' });
    expect(await screen.findByText("That day couldn't be found")).toBeOnTheScreen();
  });
});
