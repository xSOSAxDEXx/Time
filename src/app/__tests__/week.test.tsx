import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { useEntries } from '@/store/entries';
import { useSettings } from '@/store/settings';
import { emptyEntry } from '@/timecard/types';

import DayScreen from '../day/[date]';
import WeekScreen from '../(tabs)/index';
import TabsLayout from '../(tabs)/_layout';

const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': WeekScreen,
  'day/[date]': DayScreen,
};

// Wednesday 9 Jan 2030, 8:02 AM (made-up dates only).
const WED = new Date(2030, 0, 9, 8, 2);

beforeEach(() => {
  jest.useFakeTimers({ now: WED });
  useEntries.setState({ entries: {} });
  useSettings.getState().replaceAll({});
});

afterEach(() => jest.useRealTimers());

async function open() {
  await renderRouter(routes, { initialUrl: '/' });
  return screen.findByRole('header', { name: /week/ });
}

describe('week screen', () => {
  it('shows Monday to Sunday of this week with today marked', async () => {
    await open();
    expect(screen.getByRole('header', { name: 'This week · Jan 7 – 13, 2030' })).toBeOnTheScreen();
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(screen.getByText(day)).toBeOnTheScreen();
    }
    expect(screen.getByLabelText(/^Wednesday, Jan 9, today/)).toBeOnTheScreen();
  });

  it('clocks in now, and a second tap is needed to replace the time', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Clock in now' }));
    expect(useEntries.getState().entries['2030-01-09'].start).toBe('08:02');
    expect(screen.getByText('In since 8:02 AM')).toBeOnTheScreen();

    await act(async () => jest.setSystemTime(new Date(2030, 0, 9, 8, 20)));
    await fireEvent.press(screen.getByRole('button', { name: 'In at 8:02 AM' }));
    expect(useEntries.getState().entries['2030-01-09'].start).toBe('08:02');
    expect(screen.getByText('Replace 8:02 AM?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Replace 8:02 AM?'));
    expect(useEntries.getState().entries['2030-01-09'].start).toBe('08:20');
  });

  it('clocks out, and shows the day total and that the minimum was met', async () => {
    useEntries.getState().updateDay('2030-01-09', { start: '07:30', breakHours: 0.5 });
    jest.setSystemTime(new Date(2030, 0, 9, 16, 5));
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Clock out now' }));
    expect(useEntries.getState().entries['2030-01-09'].end).toBe('16:05');
    expect(screen.getByText('7:30 AM – 4:05 PM')).toBeOnTheScreen();
    expect(screen.getByText('✓ Met · min out 4:00 PM')).toBeOnTheScreen();
    expect(screen.getAllByText('8.08').length).toBeGreaterThan(0);
  });

  it('after midnight, clock out closes last night’s overnight shift', async () => {
    useEntries.getState().updateDay('2030-01-08', { start: '22:00' });
    jest.setSystemTime(new Date(2030, 0, 9, 6, 30));
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Clock out (overnight)' }));
    const tue = useEntries.getState().entries['2030-01-08'];
    expect(tue.end).toBe('06:30');
    expect(useEntries.getState().entries['2030-01-09']).toBeUndefined();
    expect(screen.getByText('10:00 PM – 6:30 AM (next day)')).toBeOnTheScreen();
  });

  it('moves between weeks', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Previous week' }));
    expect(
      screen.getByRole('header', { name: 'Week of · Dec 31, 2029 – Jan 6, 2030' }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'This week' }));
    expect(screen.getByRole('header', { name: 'This week · Jan 7 – 13, 2030' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByRole('header', { name: 'Week of · Jan 14 – 20, 2030' })).toBeOnTheScreen();
  });

  it('jumps to the week of a picked date', async () => {
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Go to the week of a date' }));
    await act(async () =>
      jest
        .requireMock<{ __pick: (d: Date) => void }>('@react-native-community/datetimepicker')
        .__pick(new Date(2030, 2, 14)),
    );
    expect(
      await screen.findByRole('header', { name: 'Week of · Mar 11 – 17, 2030' }),
    ).toBeOnTheScreen();
  });

  it('totals the week in the footer', async () => {
    const { updateDay } = useEntries.getState();
    updateDay('2030-01-07', { start: '08:00', end: '16:30', breakHours: 0.5 });
    updateDay('2030-01-08', { timeOffHours: 8, timeOffType: 'PTO' });
    await open();
    expect(
      screen.getByLabelText('Week total: 16.00. Days worked: 2. Avg hours worked WTD: 8.00'),
    ).toBeOnTheScreen();
    expect(screen.getByText('PTO 8.00 h')).toBeOnTheScreen();
  });

  it('shows the start of a long comment and opens the day on tap', async () => {
    useEntries.setState({
      entries: {
        '2030-01-07': { ...emptyEntry('2030-01-07'), comment: 'Drove to the client site' },
      },
    });
    await open();
    expect(screen.getByText('Drove to the client site')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText(/^Monday, Jan 7/));
    expect(await screen.findByRole('header', { name: 'Monday, Jan 7, 2030' })).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Drove to the client site')).toBeOnTheScreen();
  });
});
