import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeChoice = 'system' | 'light' | 'dark';

/** Minutes before the min clock-out time to remind (CLAUDE.md §3.8). */
export type ReminderLead = 0 | 5 | 10 | 15;

/** Overtime rule for the pay estimate (CLAUDE.md §3.9). */
export type OvertimeRule =
  { kind: 'none' } | { kind: 'weekly'; thresholdHours: number; multiplier: number };

export const DEFAULT_OVERTIME: OvertimeRule = {
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
  /** Time off types paid at the straight rate (others, like Unpaid, pay nothing). */
  paidTimeOffTypes: string[];
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
  paidTimeOffTypes: ['PTO', 'Floating', 'Company Holiday'],
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
