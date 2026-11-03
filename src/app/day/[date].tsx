import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ChoiceChips } from '@/components/ChoiceChips';
import { NumberField } from '@/components/NumberField';
import { Screen } from '@/components/Screen';
import { TripsEditor } from '@/components/TripsEditor';
import { TimeField } from '@/components/TimeField';
import { useNow } from '@/hooks/useNow';
import { useSoftConfirm } from '@/hooks/useSoftConfirm';
import { useTimeCard } from '@/hooks/useTimeCard';
import { useToday } from '@/hooks/useToday';
import { useEntries } from '@/store/entries';
import { useSettings } from '@/store/settings';
import {
  dayWarnings,
  entryFor,
  HOLIDAY_TIME_OFF_TYPE,
  hoursLeft,
  hoursSoFar,
  isInProgress,
  isOvernight,
  metMinClockOut,
  minClockOut,
  plannedBreak,
  totalWorked,
} from '@/timecard/calc';
import {
  addDays,
  formatClock,
  formatDuration,
  formatHours,
  formatLongDate,
  hoursToMinutes,
  isDateKey,
  minutesToHours,
} from '@/timecard/dates';
import { isEmptyEntry, type Travel } from '@/timecard/types';
import { radius, space, type, useTheme } from '@/theme';

function Field({
  label,
  children,
  grow,
}: {
  label: string;
  children: React.ReactNode;
  /** Share a row with other fields. */
  grow?: boolean;
}) {
  return (
    <View style={[styles.field, grow && styles.grow]}>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
      {children}
    </View>
  );
}

/** Edit one day (CLAUDE.md §3.1). Every change saves straight away. */
export default function DayScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ date: string }>();
  const date = isDateKey(params.date) ? params.date : null;
  const today = useToday();
  const now = new Date(useNow(30_000));
  const { entries, holidays } = useTimeCard(date ?? today, date ?? today);
  const { updateDay, clearDay } = useEntries.getState();
  const { requiredHours, timeOffTypes, locations, usualBreakMinutes } = useSettings();
  const usualBreakHours = minutesToHours(usualBreakMinutes);
  const { armed, confirm } = useSoftConfirm();
  const entry = date ? entryFor(entries, date) : null;
  // The comment being typed; null when not editing, so the saved one shows.
  const [draft, setDraft] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const go = (days: number) => date && router.setParams({ date: addDays(date, days) });

  if (!date || !entry) {
    return (
      <Screen edges={['top', 'bottom']}>
        <AppText variant="title" accessibilityRole="header">
          That day couldn&apos;t be found
        </AppText>
        <Button label="Back to the week" onPress={close} />
      </Screen>
    );
  }

  // Passing the shown day keeps an automatic holiday's time off on the first change.
  const update = (patch: Parameters<typeof updateDay>[1]) => updateDay(date, patch, entry);
  const holiday = holidays.get(date);
  const warnings = dayWarnings(entry, today);
  // Clocked in: hours so far and time left take the total's place.
  const soFar = hoursSoFar(entry, now);
  const left = hoursLeft(entry, now, requiredHours, usualBreakHours);
  const usingUsualBreak = plannedBreak(entry, usualBreakHours) !== entry.breakHours;
  const saveComment = () => {
    if (draft != null && draft !== entry.comment) update({ comment: draft });
    setDraft(null);
  };
  const total = totalWorked(entry);
  const min = minClockOut(entry, requiredHours, usualBreakHours);
  const met = metMinClockOut(entry, requiredHours);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Button label="‹" accessibilityLabel="Previous day" onPress={() => go(-1)} />
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          {formatLongDate(date)}
        </AppText>
        <Button label="›" accessibilityLabel="Next day" onPress={() => go(1)} />
      </View>

      {holiday ? (
        <View
          style={[
            styles.notice,
            { backgroundColor: colors.surfaceSoft, borderColor: colors.border },
          ]}>
          <AppText variant="bodyStrong">{holiday}</AppText>
          {entry.holiday ? (
            <>
              <AppText tone="muted">
                Counted as a company holiday ({formatHours(entry.timeOffHours)} hours).
              </AppText>
              <Button
                label="Don't count it this time"
                onPress={() =>
                  updateDay(date, { skipHoliday: true, timeOffHours: 0, timeOffType: '' })
                }
              />
            </>
          ) : entry.skipHoliday ? (
            <>
              <AppText tone="muted">Not counted as a holiday for you this time.</AppText>
              <Button
                label="Count it as a holiday"
                onPress={() =>
                  update({
                    skipHoliday: false,
                    timeOffHours: requiredHours,
                    timeOffType: HOLIDAY_TIME_OFF_TYPE,
                  })
                }
              />
            </>
          ) : entry.timeOffType !== HOLIDAY_TIME_OFF_TYPE ? (
            <Button
              label="Log as a company holiday"
              onPress={() =>
                update({ timeOffHours: requiredHours, timeOffType: HOLIDAY_TIME_OFF_TYPE })
              }
            />
          ) : null}
        </View>
      ) : null}

      {warnings.map((w) => (
        <AppText key={w} tone="warn">
          ⚠ {w}
        </AppText>
      ))}

      <View
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${
          soFar != null
            ? `Shift in progress, ${formatHours(soFar)} hours so far${left != null ? (left > 0 ? `, ${formatDuration(left)} left` : ', hours met') : ''}`
            : `Total worked ${isEmptyEntry(entry) ? 'none' : `${formatHours(total)} hours`}`
        }. ${
          min != null
            ? `Min clock out ${formatClock(min)}${met === true ? ', met' : met === false ? ', not met yet' : ''}.`
            : ''
        }`}>
        <View style={styles.stat}>
          {soFar != null ? (
            <>
              <AppText variant="caption" tone="muted">
                Hours so far
              </AppText>
              <AppText variant="display" tone="accent">
                {formatHours(soFar)}
              </AppText>
              <AppText variant="caption" tone={left != null && left <= 0 ? 'good' : 'muted'}>
                {left == null
                  ? 'Shift in progress'
                  : left > 0
                    ? `${formatDuration(left)} left`
                    : '✓ Hours met'}
              </AppText>
            </>
          ) : (
            <>
              <AppText variant="caption" tone="muted">
                Total worked
              </AppText>
              <AppText variant="display">{isEmptyEntry(entry) ? '—' : formatHours(total)}</AppText>
              {isInProgress(entry) ? (
                <AppText variant="caption" tone="muted">
                  Shift in progress
                </AppText>
              ) : null}
            </>
          )}
        </View>
        <View style={styles.stat}>
          <AppText variant="caption" tone="muted">
            Min clock out
          </AppText>
          <AppText
            variant="display"
            tone={met === true ? 'good' : met === false ? 'warn' : 'primary'}>
            {min != null ? formatClock(min) : '—'}
          </AppText>
          {met != null ? (
            <AppText variant="caption" tone={met ? 'good' : 'warn'}>
              {met ? '✓ Met' : 'Not met yet'}
            </AppText>
          ) : min != null && min >= 24 ? (
            <AppText variant="caption" tone="muted">
              Next day
            </AppText>
          ) : null}
          {usingUsualBreak ? (
            <AppText variant="caption" tone="muted">
              Includes your usual {usualBreakMinutes} min break
            </AppText>
          ) : null}
        </View>
      </View>

      <View style={styles.pair}>
        <Field label="Start shift">
          <TimeField
            label="Start shift"
            value={entry.start}
            onChange={(start) => update({ start })}
          />
        </Field>
        <Field label="End shift">
          <TimeField label="End shift" value={entry.end} onChange={(end) => update({ end })} />
        </Field>
      </View>
      {isOvernight(entry) ? (
        <AppText variant="caption" tone="muted">
          Overnight shift: ends the next day.
        </AppText>
      ) : null}
      {entry.start || entry.end ? (
        <View style={styles.pair}>
          {entry.start ? (
            <Button variant="quiet" label="Clear start" onPress={() => update({ start: '' })} />
          ) : null}
          {entry.end ? (
            <Button variant="quiet" label="Clear end" onPress={() => update({ end: '' })} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.pair}>
        <Field grow label="Break (min)">
          <NumberField
            label="Break"
            unit="minutes"
            value={hoursToMinutes(entry.breakHours)}
            onChange={(m) => update({ breakHours: minutesToHours(m) })}
          />
        </Field>
        <Field grow label="Remote (h)">
          <NumberField
            label="Remote or outside work"
            unit="hours"
            max={24}
            value={entry.remoteHours}
            onChange={(remoteHours) => update({ remoteHours })}
          />
        </Field>
        <Field grow label="Time off (h)">
          <NumberField
            label="Time off"
            unit="hours"
            max={24}
            value={entry.timeOffHours}
            onChange={(timeOffHours) => update({ timeOffHours })}
          />
        </Field>
      </View>

      <Field label="Time off type">
        <ChoiceChips
          label="Time off type"
          options={timeOffTypes}
          value={entry.timeOffType}
          onChange={(timeOffType) => update({ timeOffType })}
        />
      </Field>
      <Field label="Travel">
        <ChoiceChips
          label="Travel"
          options={['Yes', 'No']}
          value={entry.travel}
          onChange={(travel) => update({ travel: travel as Travel })}
        />
      </Field>
      <Field label="Location">
        <ChoiceChips
          label="Location"
          options={locations}
          value={entry.location}
          onChange={(location) => update({ location })}
        />
      </Field>
      <Field label="Drives">
        <TripsEditor entry={entry} onChange={update} />
      </Field>
      <Field label="Comment">
        <TextInput
          value={draft ?? entry.comment}
          onChangeText={setDraft}
          onBlur={saveComment}
          multiline
          accessibilityLabel="Comment"
          placeholder="Anything worth remembering about this day"
          placeholderTextColor={colors.textMuted}
          style={[
            type.body,
            styles.comment,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        />
      </Field>

      <View style={styles.pair}>
        <Button
          grow
          label={armed === 'clear' ? 'Tap again to clear' : 'Clear day'}
          disabled={isEmptyEntry(entry)}
          accessibilityHint="Removes everything logged for this day. Tap twice."
          onPress={() => confirm('clear', () => clearDay(date))}
        />
        <Button
          grow
          variant="primary"
          label="Done"
          onPress={() => {
            saveComment();
            close();
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    gap: space.lg,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  stat: { flex: 1, gap: 2 },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  field: { gap: space.xs },
  grow: { flex: 1, minWidth: 96 },
  notice: { gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  comment: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: space.md,
    textAlignVertical: 'top',
  },
});
