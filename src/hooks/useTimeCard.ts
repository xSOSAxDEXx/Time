import { useMemo } from 'react';

import { useEntries } from '@/store/entries';
import { useSettings } from '@/store/settings';
import { timeCard } from '@/timecard/calc';
import type { DateKey } from '@/timecard/types';

/**
 * The entries the screens work from between `from` and `to`: what's logged,
 * plus company holidays counted automatically (see `timeCard` in calc.ts).
 */
export function useTimeCard(from: DateKey, to: DateKey) {
  const entries = useEntries((s) => s.entries);
  const rules = useSettings((s) => s.holidays);
  const auto = useSettings((s) => s.autoHolidays);
  const requiredHours = useSettings((s) => s.requiredHours);
  return useMemo(
    () => timeCard(entries, { rules, auto, requiredHours }, from, to),
    [entries, rules, auto, requiredHours, from, to],
  );
}
