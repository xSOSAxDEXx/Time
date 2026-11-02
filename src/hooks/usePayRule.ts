import { useMemo } from 'react';

import { useSettings } from '@/store/settings';
import type { PayRule } from '@/timecard/pay';

/** The pay settings (CLAUDE.md §3.9), for the estimates. */
export function usePayRule(): PayRule {
  const hourlyRate = useSettings((s) => s.hourlyRate);
  const overtime = useSettings((s) => s.overtime);
  const timeOffPay = useSettings((s) => s.timeOffPay);
  return useMemo(() => ({ hourlyRate, overtime, timeOffPay }), [hourlyRate, overtime, timeOffPay]);
}
