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
  // Clocked in: the hours so far take the total's place on the right.
  const soFar = hoursSoFar(entry, now);
  const left = hoursLeft(entry, now, requiredHours, usualBreakHours);
  const working = soFar != null && left != null;

  let minText = '';
  let minTone: 'good' | 'warn' | 'muted' | 'accent' = 'muted';
  if (min != null) {
    // A no-break space keeps "4:02 PM" together when the line wraps.
    const out = `min out ${formatClock(min).replace(' ', '\u00a0')}`;
    if (working)
      [minText, minTone] =
        left > 0
          ? [`${formatDuration(left)} left · ${out}`, 'accent']
          : [`✓ Hours met · ${out}`, 'good'];
    else if (met === true) [minText, minTone] = [`✓ Met · ${out}`, 'good'];
    else if (met === false) [minText, minTone] = [`Short · ${out}`, 'warn'];
    else minText = `Min out ${formatClock(min)}`;
  }

  const name = DAY_NAMES[weekdayIndex(date)];
  const a11y = [
    `${name}, ${formatShortDate(date)}${isToday ? ', today' : ''}`,
    holiday ? `${holiday}${entry.holiday ? ', counted as a company holiday' : ''}` : '',
    summary,
    working ? `${formatHours(soFar)} hours so far` : '',
    empty || working ? '' : `${formatHours(total)} hours`,
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
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.row,
        {
          backgroundColor: isToday ? colors.today : weekend ? colors.weekend : colors.surface,
          borderColor: isToday || hovered ? colors.accent : colors.border,
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
      {working ? (
        <View style={styles.totalBox}>
          <AppText variant="number" tone="accent" style={styles.total}>
            {formatHours(soFar)}
          </AppText>
          <AppText variant="caption" tone="muted" style={styles.total}>
            so far
          </AppText>
        </View>
      ) : (
        <AppText variant="number" tone={empty ? 'muted' : 'primary'} style={styles.total}>
          {empty ? '—' : formatHours(total)}
        </AppText>
      )}
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
  totalBox: { alignItems: 'flex-end' },
  pressed: { opacity: 0.7 },
});
