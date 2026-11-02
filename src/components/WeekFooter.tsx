import { StyleSheet, View } from 'react-native';

import type { WeekStats } from '@/timecard/calc';
import { formatHours } from '@/timecard/dates';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

/** Week total, days worked and avg hours worked WTD (CLAUDE.md §3.3). */
export function WeekFooter({ stats }: { stats: WeekStats }) {
  const { colors } = useTheme();
  const items: [string, string][] = [
    ['Week total', formatHours(stats.hours)],
    ['Days worked', String(stats.daysWorked)],
    ['Avg hours worked WTD', stats.daysWorked ? formatHours(stats.avgPerDay) : '—'],
  ];
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.lg,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  item: { minWidth: 96, gap: 2 },
});
