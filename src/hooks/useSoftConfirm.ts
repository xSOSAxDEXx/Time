import { useEffect, useRef, useState } from 'react';

/**
 * Luna's soft confirm: the first tap arms an action, a second tap within a
 * few seconds does it. `armed` is the key of the armed action, if any.
 */
export function useSoftConfirm(ms = 4000) {
  const [armed, setArmed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  /** Runs `action` if `key` is already armed; otherwise arms it. */
  const confirm = (key: string, action: () => void) => {
    clearTimeout(timer.current ?? undefined);
    if (armed === key) {
      setArmed(null);
      action();
      return;
    }
    setArmed(key);
    timer.current = setTimeout(() => setArmed(null), ms);
  };
  return { armed, confirm, disarm: () => setArmed(null) };
}
