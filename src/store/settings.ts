import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { GeoPlace } from '@/geofence/engine';
import { STANDARD_HOLIDAYS, type HolidayRule } from '@/timecard/holidays';

export type ThemeChoice = 'system' | 'light' | 'dark';

/** Minutes before the min clock-out time to remind (CLAUDE.md §3.8). */
export type ReminderLead = 0 | 5 | 10 | 15;

/**
 * Overtime for the pay estimate (CLAUDE.md §3.9): none, or hours worked over
 * a weekly threshold paid at a multiple of the regular rate.
 */
export type OvertimeRule =
  { kind: 'none' } | { kind: 'weekly'; thresholdHours: number; multiplier: number };

export type WeeklyOvertime = Extract<OvertimeRule, { kind: 'weekly' }>;

export const DEFAULT_OVERTIME: WeeklyOvertime = {
  kind: 'weekly',
  thresholdHours: 40,
  multiplier: 1.5,
};

/**
 * Preferences kept on this device (CLAUDE.md §3.6). Included in backup and
 * restore. Everything about the person starts blank: the app ships with no
 * personal data.
 */
export type Settings = {
  name: string;
  badge: string;
  primaryLocation: string;
  /** Required working hours per day. */
  requiredHours: number;
  locations: string[];
  timeOffTypes: string[];
  theme: ThemeChoice;
  reminderEnabled: boolean;
  reminderLeadMinutes: ReminderLead;
  /** Hourly rate for the pay estimate; null hides pay everywhere. */
  hourlyRate: number | null;
  overtime: OvertimeRule;
  /**
   * Pay for each time off type, as a multiple of the regular rate: 0 = not
   * paid, 1 = regular pay, 1.5 = time and a half. Types not listed are paid
   * at 1.
   */
  timeOffPay: Record<string, number>;
  /**
   * Usual break in minutes, added to min clock out while clocked in until
   * the real break is logged. 0 = off.
   */
  usualBreakMinutes: number;
  /** Company holidays, kept from year to year. */
  holidays: HolidayRule[];
  /** Count each company holiday as a full day of Company Holiday time off, unless something else is logged. */
  autoHolidays: boolean;
  /** Ask to clock in/out, log breaks and drives on arriving and leaving places (Android). */
  geofencing: boolean;
  /** Circles on the map for places in the Locations list. */
  places: GeoPlace[];
};

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  badge: '',
  primaryLocation: '',
  requiredHours: 8,
  locations: ['Main office', 'Remote', 'Client site', 'Vendor', 'Other'],
  timeOffTypes: ['PTO', 'Floating', 'Company Holiday', 'Unpaid'],
  theme: 'system',
  reminderEnabled: true,
  reminderLeadMinutes: 0,
  hourlyRate: null,
  overtime: DEFAULT_OVERTIME,
  timeOffPay: { PTO: 1, Floating: 1, 'Company Holiday': 1, Unpaid: 0 },
  usualBreakMinutes: 0,
  holidays: STANDARD_HOLIDAYS,
  autoHolidays: true,
  geofencing: false,
  places: [],
};

type SettingsState = Settings & {
  update: (patch: Partial<Settings>) => void;
  /** Replaces every setting, for restore (step 6). Missing ones fall back to defaults. */
  replaceAll: (settings: Partial<Settings>) => void;
};

export function pickSettings(state: Settings): Settings {
  const out = {} as Record<keyof Settings, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) out[key] = state[key];
  return out as Settings;
}

export const useSettings = create<SettingsState>()(
  persist<SettingsState, [], [], Settings>(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
      replaceAll: (settings) => set({ ...DEFAULT_SETTINGS, ...settings }),
    }),
    {
      name: 'clocked-settings',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: pickSettings,
      // Settings added in later versions get their defaults.
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<Settings>) }),
    },
  ),
);
