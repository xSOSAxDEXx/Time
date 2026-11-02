import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ClockButtons } from '@/components/ClockButtons';
import { DayRow } from '@/components/DayRow';
import { Screen } from '@/components/Screen';
import { WeekFooter } from '@/components/WeekFooter';
import { WeekNav } from '@/components/WeekNav';
import { WeekTable } from '@/components/WeekTable';
import { useHydrated } from '@/hooks/useHydrated';
import { useToday } from '@/hooks/useToday';
import { useEntries } from '@/store/entries';
import { useSettings } from '@/store/settings';
import { entryFor, weekStats } from '@/timecard/calc';
import { mondayOf, weekDates } from '@/timecard/dates';
import { space, WIDE_BREAKPOINT } from '@/theme';

const logo = require('@/assets/brand/logo-mark.png');

export default function WeekScreen() {
  const today = useToday();
  const [monday, setMonday] = useState(() => mondayOf(today));
  const entries = useEntries((s) => s.entries);
  const settings = useSettings();
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
    <Screen wide={wide} footer={ready ? <ClockButtons today={today} /> : null}>
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
          <WeekNav monday={monday} today={today} onChange={setMonday} />
          {wide ? (
            <WeekTable
              days={days}
              today={today}
              requiredHours={settings.requiredHours}
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
                  isToday={e.date === today}
                  onPress={() => router.push({ pathname: '/day/[date]', params: { date: e.date } })}
                />
              ))}
            </View>
          )}
          <WeekFooter stats={weekStats(entries, monday)} />
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
