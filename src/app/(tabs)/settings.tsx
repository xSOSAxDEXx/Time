import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackupSection } from '@/components/BackupSection';
import { Button } from '@/components/Button';
import { ChoiceChips } from '@/components/ChoiceChips';
import { GeoSection } from '@/components/GeoSection';
import { ListEditor } from '@/components/ListEditor';
import { NumberField } from '@/components/NumberField';
import { ReminderSection } from '@/components/ReminderSection';
import { Screen } from '@/components/Screen';
import { Labeled, Section } from '@/components/Section';
import { SwitchRow } from '@/components/SwitchRow';
import { TextField } from '@/components/TextField';
import { useToday } from '@/hooks/useToday';
import { DEFAULT_OVERTIME, useSettings, type ThemeChoice } from '@/store/settings';
import { addDays, formatShortDate } from '@/timecard/dates';
import { holidaysBetween } from '@/timecard/holidays';
import { space } from '@/theme';

const THEMES: [ThemeChoice, string][] = [
  ['system', 'Match phone'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

/** Time off pay choices, as a multiple of the hourly rate. */
const PAY_RATES: [number, string][] = [
  [0, 'Not paid'],
  [1, 'Regular pay'],
  [1.5, '1.5× pay'],
];

const OVERTIME = ['None', '1.5× over 40 h a week', 'Custom'];

export default function SettingsScreen() {
  const s = useSettings();
  const update = s.update;
  const today = useToday();
  const upcoming = [...holidaysBetween(s.holidays, today, addDays(today, 366))][0];

  const overtimeChoice =
    s.overtime.kind === 'none'
      ? 'None'
      : s.overtime.thresholdHours === 40 && s.overtime.multiplier === 1.5
        ? OVERTIME[1]
        : 'Custom';
  const weekly = s.overtime.kind === 'weekly' ? s.overtime : DEFAULT_OVERTIME;

  return (
    <Screen>
      <AppText variant="display" accessibilityRole="header">
        Settings
      </AppText>

      <Section title="About you">
        <AppText variant="caption" tone="muted">
          All optional. Shown at the top of the Week screen and kept on this device only.
        </AppText>
        <Labeled label="Name">
          <TextField
            label="Name"
            value={s.name}
            onChange={(name) => update({ name })}
            autoComplete="name"
          />
        </Labeled>
        <Labeled label="Badge number">
          <TextField label="Badge number" value={s.badge} onChange={(badge) => update({ badge })} />
        </Labeled>
        <Labeled label="Primary location">
          <TextField
            label="Primary location"
            value={s.primaryLocation}
            onChange={(primaryLocation) => update({ primaryLocation })}
          />
        </Labeled>
      </Section>

      <Section title="Work day">
        <Labeled
          label="Required hours per day"
          note="Used for min clock out and the weekly target (× 5).">
          <NumberField
            label="Required hours per day"
            unit="hours"
            max={24}
            value={s.requiredHours}
            onChange={(requiredHours) => requiredHours > 0 && update({ requiredHours })}
          />
        </Labeled>
        <Labeled
          label="Usual break (minutes)"
          note="Added to min clock out while you're clocked in, until you log the real break. Leave blank for none.">
          <NumberField
            label="Usual break"
            unit="minutes"
            max={240}
            value={s.usualBreakMinutes}
            onChange={(usualBreakMinutes) => update({ usualBreakMinutes })}
          />
        </Labeled>
      </Section>

      <Section title="Company holidays">
        <SwitchRow
          label="Count holidays automatically"
          description="Each company holiday counts as a full day of Company Holiday time off unless you log something else that day."
          value={s.autoHolidays}
          onChange={(autoHolidays) => update({ autoHolidays })}
        />
        <AppText tone="muted">
          {s.holidays.length} {s.holidays.length === 1 ? 'holiday' : 'holidays'}, every year
          {upcoming ? ` · next: ${upcoming[1]}, ${formatShortDate(upcoming[0])}` : ''}
        </AppText>
        <Button label="Edit holidays" onPress={() => router.push('/holidays')} />
      </Section>

      <Section title="Lists">
        <Labeled label="Locations">
          <ListEditor
            itemName="location"
            items={s.locations}
            onChange={(locations) => update({ locations })}
          />
        </Labeled>
        <Labeled label="Time off types">
          <ListEditor
            itemName="time off type"
            items={s.timeOffTypes}
            onChange={(timeOffTypes) => update({ timeOffTypes })}
          />
        </Labeled>
      </Section>

      <Section title="Pay">
        <AppText variant="caption" tone="muted">
          For an estimate of your pay before taxes. Not an official pay stub. Leave the rate blank
          to hide pay.
        </AppText>
        <Labeled label="Hourly rate ($)">
          <NumberField
            label="Hourly rate"
            unit="dollars"
            max={10_000}
            value={s.hourlyRate ?? 0}
            onChange={(rate) => update({ hourlyRate: rate || null })}
          />
        </Labeled>
        <Labeled label="Overtime">
          <ChoiceChips
            label="Overtime"
            options={OVERTIME}
            value={overtimeChoice}
            onChange={(choice) =>
              update({
                overtime:
                  choice === 'None' || choice === ''
                    ? { kind: 'none' }
                    : choice === OVERTIME[1]
                      ? DEFAULT_OVERTIME
                      : { ...weekly, multiplier: 2 },
              })
            }
          />
        </Labeled>
        {overtimeChoice === 'Custom' ? (
          <View style={styles.pair}>
            <Labeled label="After (hours a week)">
              <NumberField
                label="Overtime after"
                unit="hours a week"
                max={168}
                value={weekly.thresholdHours}
                onChange={(thresholdHours) => update({ overtime: { ...weekly, thresholdHours } })}
              />
            </Labeled>
            <Labeled label="Pay (× regular)">
              <NumberField
                label="Overtime pay multiple"
                unit="times regular pay"
                max={5}
                value={weekly.multiplier}
                onChange={(multiplier) =>
                  multiplier > 0 && update({ overtime: { ...weekly, multiplier } })
                }
              />
            </Labeled>
          </View>
        ) : null}
        <AppText variant="caption" tone="muted">
          Only hours worked (on site and remote) count toward overtime.
        </AppText>
        {s.timeOffTypes.map((t) => {
          const rate = s.timeOffPay[t] ?? 1;
          const label = PAY_RATES.find(([r]) => r === rate)?.[1] ?? `${rate}× pay`;
          return (
            <Labeled key={t} label={`${t} pay`}>
              <ChoiceChips
                label={`${t} pay`}
                options={PAY_RATES.map(([, l]) => l)}
                value={label}
                onChange={(l) =>
                  update({
                    timeOffPay: {
                      ...s.timeOffPay,
                      [t]: PAY_RATES.find(([, x]) => x === l)?.[0] ?? 1,
                    },
                  })
                }
              />
            </Labeled>
          );
        })}
      </Section>

      <Section title="Look">
        <ChoiceChips
          label="Theme"
          options={THEMES.map(([, l]) => l)}
          value={THEMES.find(([k]) => k === s.theme)?.[1] ?? 'Match phone'}
          onChange={(l) => update({ theme: THEMES.find(([, x]) => x === l)?.[0] ?? 'system' })}
        />
      </Section>

      <ReminderSection />
      <GeoSection />
      <BackupSection />

      {Platform.OS === 'web' ? (
        <AppText variant="caption" tone="muted">
          On the web, your time card is saved in this browser only. Clearing your browser&apos;s
          data deletes it, so back up regularly.
        </AppText>
      ) : (
        <AppText variant="caption" tone="muted">
          Your time card is saved on this phone only. Nothing is sent anywhere.
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
