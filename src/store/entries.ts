import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { entryFor } from '@/timecard/calc';
import { emptyEntry, isEmptyEntry, type DateKey, type Entries, type Entry } from '@/timecard/types';

/** The fields a person edits; the date is the key. */
export type EntryPatch = Partial<Omit<Entry, 'date'>>;

type EntriesState = {
  entries: Entries;
  /** Changes some fields of a day. A day left with nothing logged is removed. */
  updateDay: (date: DateKey, patch: EntryPatch) => void;
  clearDay: (date: DateKey) => void;
  /** Sets the start time (the screen asks before replacing an existing one). */
  clockIn: (date: DateKey, time: string) => void;
  /** Sets the end time (the screen asks before replacing an existing one). */
  clockOut: (date: DateKey, time: string) => void;
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
      updateDay: (date, patch) => {
        const { entries } = get();
        set({ entries: withDay(entries, { ...entryFor(entries, date), ...patch, date }) });
      },
      clearDay: (date) => set({ entries: withDay(get().entries, emptyEntry(date)) }),
      clockIn: (date, time) => get().updateDay(date, { start: time }),
      clockOut: (date, time) => get().updateDay(date, { end: time }),
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
