import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { toKey } from '@/timecard/dates';

/**
 * Today's date key. Rechecked every minute and whenever the app comes back to
 * the foreground, so "today" moves on at midnight without a restart.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => toKey(new Date()));
  useEffect(() => {
    const check = () => setToday(toKey(new Date()));
    const id = setInterval(check, 60_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  return today;
}
