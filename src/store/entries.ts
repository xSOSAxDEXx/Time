import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { entryFor } from '@/timecard/calc';
import { emptyEntry, isEmptyEntry, type DateKey, type Entries, type Entry } from '@/timecard/types';

/** The fields a person edits; the date is the key. */
export type EntryPatch = Partial<Omit<Entry, 'date'>>;

type EntriesState = {
  entries: Entries;
  /**
   * Changes some fields of a day. A day left with nothing logged is removed.
   * `shown` is the day as the screen shows it: for a company holiday filled
   * in automatically, the first change keeps the holiday's time off.
   */
  updateDay: (date: DateKey, patch: EntryPatch, shown?: Entry) => void;
  clearDay: (date: DateKey) => void;
  /** Sets the start time (the screen asks before replacing an existing one). */
  clockIn: (date: DateKey, time: string, shown?: Entry) => void;
  /** Sets the end time (the screen asks before replacing an existing one). */
  clockOut: (date: DateKey, time: string, shown?: Entry) => void;
  /** Replaces everything, for restore (step 6). */
  replaceAll: (entries: Entries) => void;
};

function withDay(entries: Entries, entry: Entry): Entries {
  const next = { ...entries };
  if (isEmptyEntry(entry)) delete next[entry.date];
  else next[entry.date] = entry;
  return next;
}

/** Every logged day, kept on this device. Included in backup and restore. */
export const useEntries = create<EntriesState>()(
  persist(
    (set, get) => ({
      entries: {},
      updateDay: (date, patch, shown) => {
        const { entries } = get();
        const base = entries[date] ?? (shown?.date === date ? shown : entryFor(entries, date));
        // `holiday` only marks days filled in automatically; it's never saved.
        const { holiday: _holiday, ...saved } = { ...base, ...patch, date };
        set({ entries: withDay(entries, saved) });
      },
      clearDay: (date) => set({ entries: withDay(get().entries, emptyEntry(date)) }),
      clockIn: (date, time, shown) => get().updateDay(date, { start: time }, shown),
      clockOut: (date, time, shown) => get().updateDay(date, { end: time }, shown),
      replaceAll: (entries) => set({ entries }),
    }),
    {
      name: 'clocked-entries',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ entries }) => ({ entries }),
    },
  ),
);
