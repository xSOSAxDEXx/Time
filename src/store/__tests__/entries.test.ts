import AsyncStorage from '@react-native-async-storage/async-storage';

import { useEntries } from '../entries';

beforeEach(async () => {
  useEntries.setState({ entries: {} });
  await AsyncStorage.clear();
});

describe('entries store', () => {
  it('clocks in and out for a day', () => {
    useEntries.getState().clockIn('2030-01-07', '08:02');
    useEntries.getState().clockOut('2030-01-07', '16:15');
    expect(useEntries.getState().entries['2030-01-07']).toMatchObject({
      date: '2030-01-07',
      start: '08:02',
      end: '16:15',
      breakHours: 0,
    });
  });

  it('updates some fields and keeps the rest', () => {
    const { updateDay } = useEntries.getState();
    updateDay('2030-01-07', { start: '08:00', end: '16:00' });
    updateDay('2030-01-07', { breakHours: 1 / 3, comment: 'Site visit' });
    expect(useEntries.getState().entries['2030-01-07']).toMatchObject({
      start: '08:00',
      end: '16:00',
      comment: 'Site visit',
    });
  });

  it('removes a day once nothing is logged on it', () => {
    const { updateDay, clearDay } = useEntries.getState();
    updateDay('2030-01-07', { comment: 'note' });
    updateDay('2030-01-07', { comment: '  ' });
    expect(useEntries.getState().entries).toEqual({});

    updateDay('2030-01-08', { timeOffHours: 8, timeOffType: 'PTO' });
    clearDay('2030-01-08');
    expect(useEntries.getState().entries).toEqual({});
  });

  it('saves to the device', async () => {
    useEntries.getState().clockIn('2030-01-07', '07:45');
    await new Promise((r) => setTimeout(r, 0));
    const saved = JSON.parse((await AsyncStorage.getItem('clocked-entries')) ?? '{}');
    expect(saved.state.entries['2030-01-07'].start).toBe('07:45');
  });

  it('loads what was saved', async () => {
    await AsyncStorage.setItem(
      'clocked-entries',
      JSON.stringify({
        state: { entries: { '2030-01-09': { date: '2030-01-09', start: '09:00' } } },
        version: 1,
      }),
    );
    await useEntries.persist.rehydrate();
    expect(useEntries.getState().entries['2030-01-09'].start).toBe('09:00');
  });
});

describe('editing a company holiday filled in automatically', () => {
  const shown = {
    date: '2030-01-01',
    start: '',
    end: '',
    breakHours: 0,
    remoteHours: 0,
    timeOffHours: 8,
    timeOffType: 'Company Holiday',
    travel: '' as const,
    location: '',
    comment: '',
    holiday: "New Year's Day",
  };

  it('keeps the holiday time off on the first change, without saving the marker', () => {
    useEntries.getState().updateDay('2030-01-01', { comment: 'Quiet day' }, shown);
    const saved = useEntries.getState().entries['2030-01-01'];
    expect(saved).toMatchObject({
      timeOffHours: 8,
      timeOffType: 'Company Holiday',
      comment: 'Quiet day',
    });
    expect(saved).not.toHaveProperty('holiday');
  });

  it('ignores a shown day for a different date', () => {
    useEntries.getState().updateDay('2030-01-02', { comment: 'x' }, shown);
    expect(useEntries.getState().entries['2030-01-02'].timeOffHours).toBe(0);
  });
});
