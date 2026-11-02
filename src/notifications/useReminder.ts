import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { useHydrated } from '@/hooks/useHydrated';
import { useToday } from '@/hooks/useToday';
import { useEntries } from '@/store/entries';
import { useSettings } from '@/store/settings';
import { minutesToHours } from '@/timecard/dates';

import { reminderPlan, type ReminderPlan } from './plan';
import { getPermission, setUpReminders, syncReminder, type Permission } from './scheduler';

type ReminderState = {
  /** Whether Clocked may notify; null until checked. */
  permission: Permission | null;
  setPermission: (p: Permission) => void;
  /** The web banner the person closed (by plan key), so it stays closed. */
  dismissedKey: string | null;
  dismiss: (key: string) => void;
};

/** Reminder state for this session only (not saved). */
export const useReminderState = create<ReminderState>()((set) => ({
  permission: null,
  setPermission: (permission) => set({ permission }),
  dismissedKey: null,
  dismiss: (dismissedKey) => set({ dismissedKey }),
}));

/** The reminder for the shift that's open now, or null. */
export function useReminderPlan(): ReminderPlan | null {
  const entries = useEntries((s) => s.entries);
  const enabled = useSettings((s) => s.reminderEnabled);
  const leadMinutes = useSettings((s) => s.reminderLeadMinutes);
  const requiredHours = useSettings((s) => s.requiredHours);
  const usualBreakMinutes = useSettings((s) => s.usualBreakMinutes);
  const today = useToday();
  return useMemo(
    () =>
      reminderPlan(entries, today, {
        enabled,
        leadMinutes,
        requiredHours,
        usualBreakHours: minutesToHours(usualBreakMinutes),
      }),
    [entries, today, enabled, leadMinutes, requiredHours, usualBreakMinutes],
  );
}

/**
 * Keeps the scheduled clock-out reminder in step with the time card
 * (CLAUDE.md §3.8): scheduled on clock in, moved when start, break, remote
 * or time off change, cancelled on clock out or when the day is cleared.
 * Mounted once, in the tabs layout.
 */
export function useClockOutReminder(): void {
  const plan = useReminderPlan();
  const entriesReady = useHydrated(useEntries);
  const settingsReady = useHydrated(useSettings);
  const ready = entriesReady && settingsReady;
  const permission = useReminderState((s) => s.permission);
  const setPermission = useReminderState((s) => s.setPermission);

  useEffect(() => {
    setUpReminders();
    const check = () => void getPermission().then(setPermission);
    check();
    // The person may change it in the phone's settings and come back.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, [setPermission]);

  const key = plan?.key ?? null;
  useEffect(() => {
    // Before loading, an empty time card would cancel a reminder that's still wanted.
    if (!ready || permission == null) return;
    void syncReminder(plan, permission);
    // `key` captures everything about the plan that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, permission, key]);
}
