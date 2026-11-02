import { useEffect, useState } from 'react';

/**
 * The current time, refreshed every `intervalMs` while `active`. Used to
 * redraw countdowns; the timer itself is computed from timestamps, so a
 * slow refresh only affects the display.
 */
export function useNow(intervalMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    // Refresh straight away too, so a resumed countdown never shows stale time.
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [intervalMs, active]);
  return now;
}
