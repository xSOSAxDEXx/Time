import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { progressText } from '@/components/DayRow';
import { EmptyState } from '@/components/EmptyState';
import { ListIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { StatCard } from '@/components/StatCard';
import { useHydrated } from '@/hooks/useHydrated';
import { useNow } from '@/hooks/useNow';
import { usePayRule } from '@/hooks/usePayRule';
import { useTimeCard } from '@/hooks/useTimeCard';
import { useToday } from '@/hooks/useToday';
import { useEntries } from '@/store/entries';
import { useSettings } from '@/store/settings';
import { useWeekView } from '@/store/weekView';
import { formatMoney, showsPay, weekPay } from '@/timecard/pay';
import {
  allWeeks,
  entryFor,
  loggedDates,
  minClockOut,
  weekStats,
  yearToDate,
  type WeekStats,
} from '@/timecard/calc';
import {
  addDays,
  formatClock,
  formatHours,
  formatWeekRange,
  minutesToHours,
  mondayOf,
} from '@/timecard/dates';
import { MIN_TAP, radius, space, useTheme } from '@/theme';

function weekStatus(
  w: WeekStats,
  currentMonday: string,
): { text: string; tone: 'accent' | 'good' | 'muted' } {
  if (w.monday === currentMonday) return { text: 'Current', tone: 'accent' };
  if (w.full) return { text: '✓ Full week', tone: 'good' };
  return {
    text: `Partial (${w.daysWorked} ${w.daysWorked === 1 ? 'day' : 'days'})`,
    tone: 'muted',
  };
}

export default function SummaryScreen() {
  const { colors } = useTheme();
  const today = useToday();
  const now = new Date(useNow(30_000));
  const ready = useHydrated(useEntries);
  const settings = useSettings();
  const realEntries = useEntries((s) => s.entries);
  const currentMonday = mondayOf(today);
  const first = loggedDates(realEntries)[0] ?? today;
  const { entries } = useTimeCard(first < today ? first : today, addDays(currentMonday, 6));
  const setMonday = useWeekView((s) => s.setMonday);
  const payRule = usePayRule();
  const pay = (monday: string) =>
    showsPay(payRule) ? formatMoney(weekPay(entries, monday, payRule).total) : null;

  const weeks = allWeeks(entries, today);
  const ytd = yearToDate(entries, today);
  const thisWeek = weekStats(entries, today);
  const target = settings.requiredHours * 5;
  const todayEntry = entryFor(entries, today);
  const usualBreakHours = minutesToHours(settings.usualBreakMinutes);
  const min = minClockOut(todayEntry, settings.requiredHours, usualBreakHours);
  const progress = progressText(todayEntry, now, settings.requiredHours, usualBreakHours);
  const year = today.slice(0, 4);
  const shortWeeks = weeks.filter(
    (w) => w.monday.startsWith(year) && w.monday !== currentMonday && !w.full,
  ).length;

  const openWeek = (monday: string) => {
    setMonday(monday);
    router.navigate('/');
  };

  return (
    <Screen>
      <AppText variant="display" accessibilityRole="header">
        Summary
      </AppText>
      {!ready ? null : weeks.length === 0 ? (
        <EmptyState
          icon={<ListIcon color={colors.accent} size={32} />}
          title="Nothing logged yet"
          body="Clock in on the Week tab and your averages and weeks will show here."
          action={{ label: 'Go to Week', onPress: () => router.navigate('/') }}
        />
      ) : (
        <>
          <View style={styles.grid}>
            <StatCard
              label="Avg hours / week this year"
              value={ytd.fullWeeks ? formatHours(ytd.avgPerWeek) : '—'}
              note={`${ytd.fullWeeks} full ${ytd.fullWeeks === 1 ? 'week' : 'weeks'}`}
            />
            <StatCard
              label="Avg hours / day this year"
              value={ytd.fullWeeks ? formatHours(ytd.avgPerDay) : '—'}
              note="Week average ÷ 5"
            />
            <StatCard
              label="Avg hours worked / week"
              value={ytd.fullWeeks ? formatHours(ytd.avgWorkedPerWeek) : '—'}
              note="Without paid time off"
            />
            <StatCard
              label="This week"
              value={formatHours(thisWeek.hours)}
              note={
                thisWeek.hours >= target
                  ? `✓ ${formatHours(thisWeek.hours - target)} over ${target} h`
                  : `${formatHours(target - thisWeek.hours)} h left of ${target} h`
              }
              noteTone={thisWeek.hours >= target ? 'good' : 'muted'}
            />
            <StatCard
              label="Today's min clock out"
              value={min != null ? formatClock(min) : '—'}
              note={progress || (todayEntry.start ? undefined : 'Not clocked in')}
              noteTone={progress ? 'accent' : 'muted'}
            />
            <StatCard
              label="Total logged this year"
              value={formatHours(ytd.totalHours)}
              note="Hours"
            />
          </View>

          {shortWeeks ? (
            <View
              style={[
                styles.hint,
                { backgroundColor: colors.surfaceSoft, borderColor: colors.border },
              ]}>
              <AppText>
                {shortWeeks} {shortWeeks === 1 ? 'week' : 'weeks'} this year{' '}
                {shortWeeks === 1 ? 'has' : 'have'} fewer than 5 days logged, so{' '}
                {shortWeeks === 1 ? 'it’s' : 'they’re'} left out of your averages.
              </AppText>
              <AppText variant="caption" tone="muted">
                A day off counts as a day once it&apos;s logged as time off (PTO, a holiday...).
              </AppText>
            </View>
          ) : null}

          <AppText variant="title" accessibilityRole="header">
            All weeks
          </AppText>
          {showsPay(payRule) ? (
            <AppText variant="caption" tone="muted">
              Estimated pay is before taxes and isn&apos;t an official pay stub.
            </AppText>
          ) : null}
          <View style={styles.list}>
            {[...weeks].reverse().map((w) => {
              const status = weekStatus(w, currentMonday);
              const estimate = pay(w.monday);
              return (
                <Pressable
                  key={w.monday}
                  onPress={() => openWeek(w.monday)}
                  accessibilityRole="button"
                  accessibilityLabel={`Week of ${formatWeekRange(w.monday)}. ${w.daysWorked} days worked, ${formatHours(w.hours)} hours, ${w.daysWorked ? `${formatHours(w.avgPerDay)} average a day` : 'no average'}${w.timeOffHours ? `, ${formatHours(w.timeOffHours)} hours time off` : ''}${estimate ? `. Estimated pay ${estimate}` : ''}. ${status.text.replace('✓ ', '')}`}
                  accessibilityHint="Opens this week"
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                    styles.week,
                    {
                      backgroundColor: colors.surface,
                      borderColor: hovered ? colors.accent : colors.border,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.weekMain}>
                    <AppText variant="bodyStrong">{formatWeekRange(w.monday)}</AppText>
                    <AppText variant="caption" tone="muted">
                      {w.daysWorked} days ·{' '}
                      {w.daysWorked ? `${formatHours(w.avgPerDay)} avg/day` : 'no avg'}
                      {w.timeOffHours ? ` · ${formatHours(w.timeOffHours)} h off` : ''}
                    </AppText>
                    {estimate ? (
                      <AppText variant="caption" tone="muted">
                        Estimated pay {estimate}
                      </AppText>
                    ) : null}
                    <AppText variant="caption" tone={status.tone}>
                      {status.text}
                    </AppText>
                  </View>
                  <AppText variant="number">{formatHours(w.hours)}</AppText>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  hint: { gap: space.xs, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  list: { gap: space.sm },
  week: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: MIN_TAP + space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  weekMain: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
});
