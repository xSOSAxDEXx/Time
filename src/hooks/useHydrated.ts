import { useSyncExternalStore } from 'react';

type Persisted = {
  persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void };
};

/** True once a persisted store has loaded from storage. */
export function useHydrated(store: Persisted): boolean {
  return useSyncExternalStore(
    store.persist.onFinishHydration,
    store.persist.hasHydrated,
    store.persist.hasHydrated,
  );
}
