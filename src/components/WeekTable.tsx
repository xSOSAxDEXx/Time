import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useEntries, type EntryPatch } from '@/store/entries';
import { isEmptyEntry, type Entry } from '@/timecard/types';
import { dayWarnings, hoursSoFar, metMinClockOut, minClockOut, totalWorked } from '@/timecard/calc';
import { useNow } from '@/hooks/useNow';
import {
  DAY_NAMES,
  formatClock,
  formatHours,
  formatShortDate,
  hoursToMinutes,
  minutesToHours,
  weekdayIndex,
} from '@/timecard/dates';
import { radius, space, type, useTheme } from '@/theme';

import { AppText } from './AppText';
import { NumberField } from './NumberField';
import { SelectField } from './SelectField';
import { TimeField } from './TimeField';

type Props = {
  days: Entry[];
  today: string;
  requiredHours: number;
  usualBreakHours: number;
  holidays: Map<string, string>;
  locations: string[];
  timeOffTypes: string[];
};

/** [header, width] for fixed columns, or [header, min width, share of the rest]. */
const COLUMNS: readonly (readonly [string, number, number?])[] = [
  ['Day', 92],
  ['Start shift', 124],
  ['End shift', 124],
  ['Min clock out', 80],
  ['Break (min)', 58],
  ['Remote / outside (h)', 64],
  ['Time off (h)', 58],
  ['Total worked', 62],
  ['Time off type', 100, 1],
  ['Travel', 70],
  ['Location', 100, 1],
  ['Comment', 104, 1.4],
];

/** A column's width: fixed, or a share of what's left (no sideways scrolling). */
const col = (i: number) => {
  const [, width, grow] = COLUMNS[i];
  return grow ? { flex: grow, minWidth: width } : { width };
};

/** Comment cell: saves on blur; hovering shows the whole comment (CLAUDE.md §3.3). */
function CommentCell({ entry, label }: { entry: Entry; label: string }) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const save = () => {
    if (draft != null && draft !== entry.comment) {
      useEntries.getState().updateDay(entry.date, { comment: draft }, entry);
    }
    setDraft(null);
  };
  return (
    <View
      style={[col(COLUMNS.length - 1), hover && styles.raised]}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}>
      <TextInput
        value={draft ?? entry.comment}
        onChangeText={setDraft}
        onFocus={() => setDraft(entry.comment)}
        onBlur={save}
        multiline
        accessibilityLabel={label}
        style={[
          type.caption,
          styles.comment,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />
      {hover && draft == null && entry.comment.trim() ? (
        <View
          role="tooltip"
          style={[styles.tip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="caption" tone="muted">
            {formatShortDate(entry.date)}
          </AppText>
          <AppText variant="body">{entry.comment}</AppText>
        </View>
      ) : null}
    </View>
  );
}

/** The whole week as an editable table, for wide screens (CLAUDE.md §3.3). */
export function WeekTable({
  days,
  today,
  requiredHours,
  usualBreakHours,
  holidays,
  locations,
  timeOffTypes,
}: Props) {
  const { colors } = useTheme();
  const now = new Date(useNow(30_000));
  // Passing the shown day keeps an automatic holiday's time off on the first edit.
  const update = (e: Entry, patch: EntryPatch) => useEntries.getState().updateDay(e.date, patch, e);
  return (
    <View
      role="table"
      style={[styles.table, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View role="row" style={[styles.row, styles.head, { borderColor: colors.border }]}>
        {COLUMNS.map(([name], i) => (
          <View key={name} role="columnheader" style={col(i)}>
            <AppText variant="caption" tone="muted" style={styles.headText}>
              {name}
            </AppText>
          </View>
        ))}
      </View>
      {days.map((e, i) => {
        const name = DAY_NAMES[weekdayIndex(e.date)];
        const isToday = e.date === today;
        const min = minClockOut(e, requiredHours, usualBreakHours);
        const warnings = dayWarnings(e, today);
        const holiday = holidays.get(e.date);
        const met = metMinClockOut(e, requiredHours);
        // Clocked in: hours so far in place of the total (like the phone list).
        const soFar = hoursSoFar(e, now);
        const label = (field: string) => `${name} ${field}`;
        return (
          <View
            key={e.date}
            role="row"
            style={[
              styles.row,
              { borderColor: colors.border, zIndex: days.length - i },
              isToday && { backgroundColor: colors.today },
              !isToday && i >= 5 && { backgroundColor: colors.weekend },
            ]}>
            <View style={col(0)}>
              <AppText variant="bodyStrong">{name}</AppText>
              <AppText variant="caption" tone={isToday ? 'accent' : 'muted'}>
                {formatShortDate(e.date)}
                {isToday ? ' · today' : ''}
              </AppText>
              {holiday ? (
                <AppText variant="caption" tone="accent" numberOfLines={1}>
                  {holiday}
                </AppText>
              ) : null}
              {warnings.length ? (
                <AppText
                  variant="caption"
                  tone="warn"
                  accessibilityLabel={`Check: ${warnings.join(' ')}`}>
                  ⚠ {warnings[0]}
                </AppText>
              ) : null}
            </View>
            <View style={col(1)}>
              <TimeField
                compact
                label={label('start shift')}
                value={e.start}
                onChange={(start) => update(e, { start })}
              />
            </View>
            <View style={col(2)}>
              <TimeField
                compact
                label={label('end shift')}
                value={e.end}
                onChange={(end) => update(e, { end })}
              />
            </View>
            <View style={col(3)}>
              <AppText
                variant="number"
                accessibilityLabel={
                  min != null
                    ? `${label('min clock out')}: ${formatClock(min)}${
                        met === true ? ', met' : met === false ? ', short' : ''
                      }`
                    : `${label('min clock out')}: none`
                }
                tone={met === true ? 'good' : met === false ? 'warn' : 'primary'}>
                {min != null ? `${met === true ? '✓ ' : ''}${formatClock(min)}` : '—'}
              </AppText>
            </View>
            <View style={col(4)}>
              <NumberField
                compact
                unit="minutes"
                label={label('break')}
                value={hoursToMinutes(e.breakHours)}
                onChange={(m) => update(e, { breakHours: minutesToHours(m) })}
              />
            </View>
            <View style={col(5)}>
              <NumberField
                compact
                unit="hours"
                max={24}
                label={label('remote or outside work')}
                value={e.remoteHours}
                onChange={(remoteHours) => update(e, { remoteHours })}
              />
            </View>
            <View style={col(6)}>
              <NumberField
                compact
                unit="hours"
                max={24}
                label={label('time off')}
                value={e.timeOffHours}
                onChange={(timeOffHours) => update(e, { timeOffHours })}
              />
            </View>
            <View style={col(7)}>
              {soFar != null ? (
                <AppText
                  variant="number"
                  tone="accent"
                  style={styles.right}
                  accessibilityLabel={`${label('hours so far')}: ${formatHours(soFar)}`}>
                  {formatHours(soFar)}
                  <AppText variant="caption" tone="muted">
                    {' '}
                    so far
                  </AppText>
                </AppText>
              ) : (
                <AppText
                  variant="number"
                  tone={isEmptyEntry(e) ? 'muted' : 'primary'}
                  style={styles.right}>
                  {isEmptyEntry(e) ? '—' : formatHours(totalWorked(e))}
                </AppText>
              )}
            </View>
            <View style={col(8)}>
              <SelectField
                label={label('time off type')}
                options={timeOffTypes}
                value={e.timeOffType}
                onChange={(timeOffType) => update(e, { timeOffType })}
              />
            </View>
            <View style={col(9)}>
              <SelectField
                label={label('travel')}
                options={['Yes', 'No']}
                value={e.travel}
                onChange={(travel) => update(e, { travel: travel as Entry['travel'] })}
              />
            </View>
            <View style={col(10)}>
              <SelectField
                label={label('location')}
                options={locations}
                value={e.location}
                onChange={(location) => update(e, { location })}
              />
            </View>
            <CommentCell entry={e} label={label('comment')} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { borderWidth: 1, borderRadius: radius.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  head: { alignItems: 'flex-end' },
  headText: { fontWeight: '600' },
  right: { textAlign: 'right' },
  raised: { zIndex: 10 },
  comment: { minHeight: 40, borderWidth: 1, borderRadius: radius.sm, padding: 6 },
  tip: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    width: 360,
    maxWidth: 420,
    padding: space.md,
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.md,
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  },
});
