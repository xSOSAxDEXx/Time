import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ChoiceChips } from '@/components/ChoiceChips';
import { NumberField } from '@/components/NumberField';
import { Screen } from '@/components/Screen';
import { Labeled, Section } from '@/components/Section';
import { SwitchRow } from '@/components/SwitchRow';
import { TextField } from '@/components/TextField';
import { useSoftConfirm } from '@/hooks/useSoftConfirm';
import { useToday } from '@/hooks/useToday';
import { useSettings } from '@/store/settings';
import { DAY_NAMES, formatShortDate, weekdayIndex } from '@/timecard/dates';
import {
  describeRule,
  holidayDate,
  MONTH_NAMES,
  STANDARD_HOLIDAYS,
  type HolidayRule,
} from '@/timecard/holidays';
import { radius, space, useTheme } from '@/theme';

const KINDS = ['Same date every year', 'A weekday of the month'];
const NTH: [number, string][] = [
  [1, '1st'],
  [2, '2nd'],
  [3, '3rd'],
  [4, '4th'],
  [-1, 'Last'],
];
const SHORT_MONTHS = MONTH_NAMES.map((m) => m.slice(0, 3));
const SHORT_DAYS = DAY_NAMES.map((d) => d.slice(0, 3));

function whenIn(rule: HolidayRule, year: number): string {
  const date = holidayDate(rule, year);
  return date ? `${SHORT_DAYS[weekdayIndex(date)]}, ${formatShortDate(date)}, ${year}` : 'none';
}

/** Company holidays, kept from year to year (owner request). */
export default function HolidaysScreen() {
  const { colors } = useTheme();
  const { holidays, update } = useSettings();
  const year = Number(useToday().slice(0, 4));
  const { armed, confirm } = useSoftConfirm();

  const [name, setName] = useState('');
  const [kind, setKind] = useState(KINDS[0]);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [observed, setObserved] = useState(true);
  const [nth, setNth] = useState(1);
  const [weekday, setWeekday] = useState(0);
  const [dayAfter, setDayAfter] = useState(false);
  const [error, setError] = useState('');

  const close = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  const add = () => {
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const rule: HolidayRule =
      kind === KINDS[0]
        ? { kind: 'fixed', id, name: name.trim(), month, day, observed }
        : {
            kind: 'weekday',
            id,
            name: name.trim(),
            month,
            weekday,
            nth,
            offsetDays: dayAfter ? 1 : 0,
          };
    if (!rule.name) return setError('Give the holiday a name.');
    if (!holidayDate(rule, year) && !holidayDate(rule, year + 1)) {
      return setError(`${MONTH_NAMES[month - 1]} doesn't have that day.`);
    }
    update({ holidays: [...holidays, rule] });
    setName('');
    setError('');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <AppText variant="title" accessibilityRole="header" style={styles.flex}>
          Company holidays
        </AppText>
        <Button label="Done" variant="primary" onPress={close} />
      </View>
      <AppText tone="muted">
        These repeat every year, so you never enter them again. Fixed dates that land on a weekend
        move to the Friday before or the Monday after.
      </AppText>

      {holidays.map((h) => (
        <View
          key={h.id}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{h.name}</AppText>
            <AppText variant="caption" tone="muted">
              {describeRule(h)}
            </AppText>
            <AppText variant="caption">
              {whenIn(h, year)} · {whenIn(h, year + 1)}
            </AppText>
          </View>
          <Button
            variant="quiet"
            label={armed === h.id ? 'Tap again' : 'Remove'}
            accessibilityLabel={
              armed === h.id ? `Tap again to remove ${h.name}` : `Remove ${h.name}`
            }
            onPress={() =>
              confirm(h.id, () => update({ holidays: holidays.filter((x) => x.id !== h.id) }))
            }
          />
        </View>
      ))}
      {holidays.length === 0 ? <AppText tone="muted">No holidays.</AppText> : null}

      <Section title="Add a holiday">
        <Labeled label="Name">
          <TextField label="Holiday name" value={name} onChange={setName} />
        </Labeled>
        <ChoiceChips
          label="Kind of date"
          options={KINDS}
          value={kind}
          onChange={(k) => k && setKind(k)}
        />
        {kind === KINDS[1] ? (
          <>
            <Labeled label="Which">
              <ChoiceChips
                label="Which one in the month"
                options={NTH.map(([, l]) => l)}
                value={NTH.find(([n]) => n === nth)?.[1] ?? '1st'}
                onChange={(l) => l && setNth(NTH.find(([, x]) => x === l)?.[0] ?? 1)}
              />
            </Labeled>
            <Labeled label="Weekday">
              <ChoiceChips
                label="Weekday"
                options={SHORT_DAYS}
                value={SHORT_DAYS[weekday]}
                onChange={(d) => d && setWeekday(SHORT_DAYS.indexOf(d))}
              />
            </Labeled>
          </>
        ) : null}
        <Labeled label="Month">
          <ChoiceChips
            label="Month"
            options={SHORT_MONTHS}
            value={SHORT_MONTHS[month - 1]}
            onChange={(m) => m && setMonth(SHORT_MONTHS.indexOf(m) + 1)}
          />
        </Labeled>
        {kind === KINDS[0] ? (
          <>
            <Labeled label="Day of the month">
              <NumberField
                label="Day of the month"
                unit="day"
                max={31}
                value={day}
                onChange={(d) => d >= 1 && setDay(Math.round(d))}
              />
            </Labeled>
            <SwitchRow
              label="Move off weekends"
              description="Saturday → the Friday before, Sunday → the Monday after"
              value={observed}
              onChange={setObserved}
            />
          </>
        ) : (
          <SwitchRow
            label="The day after"
            description="For example, the Friday after Thanksgiving"
            value={dayAfter}
            onChange={setDayAfter}
          />
        )}
        {error ? <AppText tone="warn">{error}</AppText> : null}
        <Button label="Add holiday" variant="primary" onPress={add} />
      </Section>

      <Button
        label={armed === 'reset' ? 'Tap again to reset' : 'Reset to the standard holidays'}
        accessibilityHint="Replaces this list with the standard company holidays. Tap twice."
        onPress={() => confirm('reset', () => update({ holidays: STANDARD_HOLIDAYS }))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
