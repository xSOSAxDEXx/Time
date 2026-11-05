import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SETTINGS, FIELD_GROUP_SETTINGS, useSettings } from '../settings';

beforeEach(async () => {
  useSettings.getState().replaceAll({});
  await AsyncStorage.clear();
});

describe('settings store', () => {
  it('starts blank about the person, with an 8-hour day', () => {
    const s = useSettings.getState();
    expect(s.name).toBe('');
    expect(s.badge).toBe('');
    expect(s.primaryLocation).toBe('');
    expect(s.requiredHours).toBe(8);
    expect(s.hourlyRate).toBeNull();
    expect(s.theme).toBe('system');
    expect(s.timeOffPay).toMatchObject({ PTO: 1, Unpaid: 0 });
    expect(s.usualBreakMinutes).toBe(0);
    expect(s.autoHolidays).toBe(true);
    expect(s.holidays.map((h) => h.name)).toContain('Christmas Day');
  });

  it('updates and saves settings', async () => {
    useSettings.getState().update({ requiredHours: 7.5, name: 'Sam Example' });
    await new Promise((r) => setTimeout(r, 0));
    const saved = JSON.parse((await AsyncStorage.getItem('clocked-settings')) ?? '{}');
    expect(saved.state).toMatchObject({ requiredHours: 7.5, name: 'Sam Example' });
    expect(saved.state).not.toHaveProperty('update');
  });

  it('fills in settings missing from older saved data with defaults', async () => {
    await AsyncStorage.setItem(
      'clocked-settings',
      JSON.stringify({ state: { requiredHours: 9 }, version: 1 }),
    );
    await useSettings.persist.rehydrate();
    const s = useSettings.getState();
    expect(s.requiredHours).toBe(9);
    expect(s.timeOffTypes).toEqual(DEFAULT_SETTINGS.timeOffTypes);
    expect(s.overtime).toEqual(DEFAULT_SETTINGS.overtime);
  });

  it('fills in fields added inside a setting since it was saved', async () => {
    // As an older version saved them: no commute, no partner bills, no gas price.
    const { bills: _bills, ...oldPartner } = DEFAULT_SETTINGS.partner;
    await AsyncStorage.setItem(
      'clocked-settings',
      JSON.stringify({
        state: {
          finance: { ...DEFAULT_SETTINGS.finance, federalPct: 12 },
          driving: { mpg: 30, routes: [] },
          partner: { ...oldPartner, enabled: true, takeHome: 900 },
          overtime: { kind: 'none' },
          timeOffPay: { PTO: 1 },
        },
        version: 1,
      }),
    );
    await useSettings.persist.rehydrate();
    const s = useSettings.getState();
    expect(s.finance.federalPct).toBe(12);
    expect(s.finance.deductions).toEqual([]);
    expect(s.driving).toEqual({ ...DEFAULT_SETTINGS.driving, mpg: 30, routes: [] });
    expect(s.partner).toMatchObject({ enabled: true, takeHome: 900, bills: [] });
    // A rule and a list of names are kept exactly as saved.
    expect(s.overtime).toEqual({ kind: 'none' });
    expect(s.timeOffPay).toEqual({ PTO: 1 });
  });

  it('knows every setting that is a group of fields', () => {
    // A new setting that's an object must be listed in FIELD_GROUP_SETTINGS
    // (or here, if filling in defaults would change what was saved).
    const notGroups = ['overtime', 'timeOffPay'];
    const objects = Object.entries(DEFAULT_SETTINGS)
      .filter(([, v]) => typeof v === 'object' && v !== null && !Array.isArray(v))
      .map(([k]) => k)
      .filter((k) => !notGroups.includes(k));
    expect(objects.sort()).toEqual([...FIELD_GROUP_SETTINGS].sort());
  });
});
