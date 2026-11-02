import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { EMPTY_GEO_STATE, type GeoState } from '@/geofence/engine';

type GeoStore = GeoState & {
  set: (state: GeoState) => void;
  /** What's registered with the phone, so it isn't re-registered on every start. */
  registeredKey: string | null;
  setRegisteredKey: (key: string | null) => void;
};

/**
 * Arrive-and-leave state (CLAUDE.md §3.11): which places we're in, the last
 * time we left one, and questions waiting for an answer. Kept on this device
 * only; not included in backups. No location history is ever stored.
 */
export const useGeo = create<GeoStore>()(
  persist(
    (set) => ({
      ...EMPTY_GEO_STATE,
      set: ({ inside, pendingExit, prompts }) => set({ inside, pendingExit, prompts }),
      registeredKey: null,
      setRegisteredKey: (registeredKey) => set({ registeredKey }),
    }),
    {
      name: 'clocked-geo',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ inside, pendingExit, prompts, registeredKey }) => ({
        inside,
        pendingExit,
        prompts,
        registeredKey,
      }),
    },
  ),
);
