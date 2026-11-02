import { useMemo } from 'react';

import { useEntries } from '@/store/entries';
import { useSettings } from '@/store/settings';
import { loggedDates, withHolidays } from '@/timecard/calc';
import { holidaysBetween } from '@/timecard/holidays';
import type { DateKey, Entries } from '@/timecard/types';

/**
 * The entries the screens work from between `from` and `to`: what's logged,
 * plus company holidays counted automatically (when that's on in Settings).
 * Holidays before the first logged day are left out, so they never add
 * weeks from before you started using the app. `holidays` names every
 * holiday in the range, counted or not.
 */
export function useTimeCard(from: DateKey, to: DateKey) {
  const entries = useEntries((s) => s.entries);
  const rules = useSettings((s) => s.holidays);
  const auto = useSettings((s) => s.autoHolidays);
  const requiredHours = useSettings((s) => s.requiredHours);
  return useMemo(() => {
    const holidays = holidaysBetween(rules, from, to);
    const first = loggedDates(entries)[0];
    const counted = new Map(auto && first ? [...holidays].filter(([date]) => date >= first) : []);
    return {
      entries: withHolidays(entries, counted, requiredHours) as Entries,
      holidays,
    };
  }, [entries, rules, auto, requiredHours, from, to]);
}
