import { create } from 'zustand';

import { mondayOf, toKey } from '@/timecard/dates';

/**
 * The week open on the Week tab. Shared (not saved) so the Summary's All
 * weeks list can open a week there.
 */
export const useWeekView = create<{ monday: string; setMonday: (monday: string) => void }>()(
  (set) => ({
    monday: mondayOf(toKey(new Date())),
    setMonday: (monday) => set({ monday: mondayOf(monday) }),
  }),
);
