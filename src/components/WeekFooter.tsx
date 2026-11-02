import { StyleSheet, View } from 'react-native';

import type { WeekStats } from '@/timecard/calc';
import { formatHours } from '@/timecard/dates';
import { formatMoney, PAY_NOTE, payBreakdown, type Pay } from '@/timecard/pay';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

/**
 * Week total, days worked and avg hours worked WTD (CLAUDE.md §3.3), plus
 * the estimated pay when an hourly rate is set (§3.9).
 */
export function WeekFooter({ stats, pay }: { stats: WeekStats; pay?: Pay | null }) {
  const { colors } = useTheme();
  const items: [string, string][] = [
    ['Week total', formatHours(stats.hours)],
    ['Days worked', String(stats.daysWorked)],
    ['Avg hours worked WTD', stats.daysWorked ? formatHours(stats.avgPerDay) : '—'],
  ];
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View
        style={styles.row}
        accessible
        accessibilityLabel={items.map(([k, v]) => `${k}: ${v}`).join('. ')}>
        {items.map(([k, v]) => (
          <View key={k} style={styles.item}>
            <AppText variant="caption" tone="muted">
              {k}
            </AppText>
            <AppText variant="display">{v}</AppText>
          </View>
        ))}
      </View>
      {pay ? (
        <View
          style={[styles.pay, { borderColor: colors.border }]}
          accessible
          accessibilityLabel={`Estimated pay: ${formatMoney(pay.total)}. ${payBreakdown(pay)}. ${PAY_NOTE}`}>
          <AppText variant="caption" tone="muted">
            Estimated pay
          </AppText>
          <AppText variant="display">{formatMoney(pay.total)}</AppText>
          <AppText variant="caption" tone="muted">
            {payBreakdown(pay)}
          </AppText>
          <AppText variant="caption" tone="muted">
            {PAY_NOTE}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  item: { minWidth: 96, gap: 2 },
  pay: { gap: 2, borderTopWidth: 1, paddingTop: space.md },
});
