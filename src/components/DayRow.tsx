import { Pressable, StyleSheet, View } from 'react-native';

import {
  hoursLeft,
  hoursSoFar,
  isInProgress,
  isOvernight,
  metMinClockOut,
  minClockOut,
  totalWorked,
} from '@/timecard/calc';
import {
  clockToHours,
  DAY_NAMES,
  formatClock,
  formatDuration,
  formatHours,
  formatShortDate,
  weekdayIndex,
} from '@/timecard/dates';
import { isEmptyEntry, type Entry } from '@/timecard/types';
import { MIN_TAP, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  entry: Entry;
  requiredHours: number;
  usualBreakHours: number;
  isToday: boolean;
  /** The company holiday on this date, if any. */
  holiday?: string;
  /** Things that look like a mistake (dayWarnings). */
  warnings: string[];
  /** For hours so far while clocked in. */
  now: Date;
  onPress: () => void;
};

const clock = (t: string) => formatClock(clockToHours(t) ?? 0);

/** What the day looks like in a few words. */
export function daySummary(e: Entry): string {
  if (isInProgress(e)) return `In since ${clock(e.start)}`;
  if (e.start && e.end)
    return `${clock(e.start)} – ${clock(e.end)}${isOvernight(e) ? ' (next day)' : ''}`;
  if (e.end) return `Out at ${clock(e.end)}`;
  const parts = [];
  // A no-break space keeps "8.00 h" together when the line wraps.
  if (e.timeOffHours)
    parts.push(`${e.timeOffType || 'Time off'} ${formatHours(e.timeOffHours)}\u00a0h`);
  if (e.remoteHours) parts.push(`Remote ${formatHours(e.remoteHours)}\u00a0h`);
  return parts.join(' · ') || 'Nothing logged';
}

/** "4.25 h so far · 3:45 left" while clocked in, otherwise ''. */
export function progressText(
  e: Entry,
  now: Date,
  requiredHours: number,
  usualBreakHours: number,
): string {
  const soFar = hoursSoFar(e, now);
  const left = hoursLeft(e, now, requiredHours, usualBreakHours);
  if (soFar == null || left == null) return '';
  return `${formatHours(soFar)} h so far · ${left > 0 ? `${formatDuration(left)} left` : 'hours met'}`;
}

/** One day of the week on a phone: tap to edit (CLAUDE.md §3.3). */
export function DayRow({
  entry,
  requiredHours,
  usualBreakHours,
  isToday,
  holiday,
  warnings,
  now,
  onPress,
}: Props) {
  const { colors } = useTheme();
  const date = entry.date;
  const empty = isEmptyEntry(entry);
  const weekend = weekdayIndex(date) >= 5;
  const total = totalWorked(entry);
  const min = minClockOut(entry, requiredHours, usualBreakHours);
  const met = metMinClockOut(entry, requiredHours);
  const summary = daySummary(entry);
  const progress = progressText(entry, now, requiredHours, usualBreakHours);

  let minText = '';
  let minTone: 'good' | 'warn' | 'muted' = 'muted';
  if (min != null) {
    if (met === true) [minText, minTone] = [`✓ Met · min out ${formatClock(min)}`, 'good'];
    else if (met === false) [minText, minTone] = [`Short · min out ${formatClock(min)}`, 'warn'];
    else minText = `Min out ${formatClock(min)}`;
  }

  const name = DAY_NAMES[weekdayIndex(date)];
  const a11y = [
    `${name}, ${formatShortDate(date)}${isToday ? ', today' : ''}`,
    holiday ? `${holiday}${entry.holiday ? ', counted as a company holiday' : ''}` : '',
    summary,
    progress,
    empty ? '' : `${formatHours(total)} hours`,
    minText.replace('✓ ', ''),
    entry.comment ? `Comment: ${entry.comment}` : '',
    ...warnings.map((w) => `Check: ${w}`),
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Opens the day to edit it"
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: isToday ? colors.today : weekend ? colors.weekend : colors.surface,
          borderColor: isToday ? colors.accent : colors.border,
        },
        pressed && styles.pressed,
      ]}>
      <View style={styles.day}>
        <AppText variant="bodyStrong">{name.slice(0, 3)}</AppText>
        <AppText variant="caption" tone="muted">
          {formatShortDate(date)}
        </AppText>
        {isToday ? (
          <AppText variant="caption" tone="accent">
            Today
          </AppText>
        ) : null}
      </View>
      <View style={styles.middle}>
        {holiday ? (
          <AppText variant="caption" tone="accent">
            {holiday}
          </AppText>
        ) : null}
        <AppText variant="body" tone={empty ? 'muted' : 'primary'}>
          {summary}
        </AppText>
        {progress ? (
          <AppText variant="caption" tone="accent">
            {progress}
          </AppText>
        ) : null}
        {minText ? (
          <AppText variant="caption" tone={minTone}>
            {minText}
          </AppText>
        ) : null}
        {entry.comment ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {entry.comment}
          </AppText>
        ) : null}
        {warnings.map((w) => (
          <AppText key={w} variant="caption" tone="warn">
            ⚠ {w}
          </AppText>
        ))}
      </View>
      <AppText variant="number" tone={empty ? 'muted' : 'primary'} style={styles.total}>
        {empty ? '—' : formatHours(total)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: MIN_TAP + space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  day: { width: 56 },
  middle: { flex: 1, gap: 2 },
  total: { minWidth: 52, textAlign: 'right' },
  pressed: { opacity: 0.7 },
});
