import { router } from 'expo-router';
import { Image, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ClockButtons } from '@/components/ClockButtons';
import { DayRow } from '@/components/DayRow';
import { ReminderBanner } from '@/components/ReminderBanner';
import { Screen } from '@/components/Screen';
import { WeekFooter } from '@/components/WeekFooter';
import { usePayRule } from '@/hooks/usePayRule';
import { WeekNav } from '@/components/WeekNav';
import { WeekTable } from '@/components/WeekTable';
import { useHydrated } from '@/hooks/useHydrated';
import { useNow } from '@/hooks/useNow';
import { useTimeCard } from '@/hooks/useTimeCard';
import { useToday } from '@/hooks/useToday';
import { useEntries } from '@/store/entries';
import { useSettings } from '@/store/settings';
import { useWeekView } from '@/store/weekView';
import { showsPay, weekPay } from '@/timecard/pay';
import { dayWarnings, entryFor, weekStats } from '@/timecard/calc';
import { addDays, minutesToHours, weekDates } from '@/timecard/dates';
import { space, WIDE_BREAKPOINT } from '@/theme';

const logo = require('@/assets/brand/logo-mark.png');

export default function WeekScreen() {
  const today = useToday();
  const { monday, setMonday } = useWeekView();
  const settings = useSettings();
  const payRule = usePayRule();
  const now = new Date(useNow(30_000));
  // The viewed week, plus today and yesterday for the clock buttons.
  const yesterday = addDays(today, -1);
  const sunday = addDays(monday, 6);
  const { entries, holidays } = useTimeCard(
    monday < yesterday ? monday : yesterday,
    sunday > today ? sunday : today,
  );
  const usualBreakHours = minutesToHours(settings.usualBreakMinutes);
  const entriesReady = useHydrated(useEntries);
  const settingsReady = useHydrated(useSettings);
  const ready = entriesReady && settingsReady;
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= WIDE_BREAKPOINT;

  const days = weekDates(monday).map((d) => entryFor(entries, d));
  const who = [settings.name, settings.badge && `Badge ${settings.badge}`, settings.primaryLocation]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen wide={wide} footer={ready ? <ClockButtons today={today} entries={entries} /> : null}>
      <View style={styles.header}>
        <Image source={logo} style={styles.logo} accessibilityIgnoresInvertColors alt="" />
        <View style={styles.headerText}>
          <AppText variant="display" accessibilityRole="header">
            Clocked
          </AppText>
          {who ? <AppText tone="muted">{who}</AppText> : null}
        </View>
      </View>
      {ready ? (
        <>
          <ReminderBanner />
          <WeekNav monday={monday} today={today} onChange={setMonday} />
          {wide ? (
            <WeekTable
              days={days}
              today={today}
              requiredHours={settings.requiredHours}
              usualBreakHours={usualBreakHours}
              holidays={holidays}
              locations={settings.locations}
              timeOffTypes={settings.timeOffTypes}
            />
          ) : (
            <View style={styles.list}>
              {days.map((e) => (
                <DayRow
                  key={e.date}
                  entry={e}
                  requiredHours={settings.requiredHours}
                  usualBreakHours={usualBreakHours}
                  isToday={e.date === today}
                  holiday={holidays.get(e.date)}
                  warnings={dayWarnings(e, today)}
                  now={now}
                  onPress={() => router.push({ pathname: '/day/[date]', params: { date: e.date } })}
                />
              ))}
            </View>
          )}
          <WeekFooter
            stats={weekStats(entries, monday)}
            pay={showsPay(payRule) ? weekPay(entries, monday, payRule) : null}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1, gap: 2 },
  logo: { width: 56, height: 56 },
  list: { gap: space.sm },
});
