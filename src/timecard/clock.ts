import { isInProgress } from './calc';
import { addDays } from './dates';
import type { DateKey, Entries } from './types';

/**
 * Which day "Clock out now" closes. Normally today; but just after midnight,
 * with nothing started today and yesterday's shift still open, it's
 * yesterday's overnight shift.
 */
export function clockOutDate(entries: Entries, today: DateKey): DateKey {
  const todays = entries[today];
  if (todays?.start) return today;
  const yesterday = addDays(today, -1);
  const prev = entries[yesterday];
  return prev && isInProgress(prev) ? yesterday : today;
}
