import { useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ColumnChart, type ChartBar } from '@/components/ColumnChart';
import { RangePicker } from '@/components/RangePicker';
import { Screen } from '@/components/Screen';
import { useHydrated } from '@/hooks/useHydrated';
import { usePayRule } from '@/hooks/usePayRule';
import { useTimeCard } from '@/hooks/useTimeCard';
import { useToday } from '@/hooks/useToday';
import { useEntries } from '@/store/entries';
import { useSettings } from '@/store/settings';
import {
  dayBars,
  orderedRange,
  presetRange,
  rangeSummary,
  type DateRange,
  type RangePreset,
  weekBars,
} from '@/timecard/charts';
import {
  addDays,
  clockToHours,
  DAY_NAMES,
  formatClock,
  formatHours,
  formatLongDate,
  formatShortDate,
  formatWeekRange,
  fromKey,
  hoursToMinutes,
  mondayOf,
  weekdayIndex,
} from '@/timecard/dates';
import { formatMoney, PAY_NOTE, payBreakdown, rangePay, showsPay } from '@/timecard/pay';
import { radius, space, useTheme, WIDE_BREAKPOINT } from '@/theme';

const md = (key: string) => {
  const d = fromKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
const clock = (t: string) => formatClock(clockToHours(t) ?? 0);
const withYear = (key: string) => `${formatShortDate(key)}, ${fromKey(key).getFullYear()}`;

/** Hours per day and per week over a date range (CLAUDE.md §3.5). */
export default function ChartsScreen() {
  const { colors } = useTheme();
  const today = useToday();
  const ready = useHydrated(useEntries);
  const realEntries = useEntries((s) => s.entries);
  const requiredHours = useSettings((s) => s.requiredHours);
  const payRule = usePayRule();
  const [preset, setPreset] = useState<RangePreset>('week');
  const [custom, setCustom] = useState<DateRange | null>(null);
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= WIDE_BREAKPOINT;

  const range =
    preset === 'custom' && custom
      ? custom
      : presetRange(preset === 'custom' ? 'week' : preset, today, realEntries);
  // Whole weeks either side, so the week columns are complete.
  const { entries } = useTimeCard(mondayOf(range.from), addDays(mondayOf(range.to), 6));
  const summary = rangeSummary(entries, range);
  const pay = showsPay(payRule) ? rangePay(entries, range.from, range.to, payRule) : null;
  const target = requiredHours * 5;
  const c = colors.chart;

  const days = dayBars(entries, range);
  const twoLine = days.length <= 10;
  const dayChart: ChartBar[] = days.map((b) => {
    const e = b.entry;
    const times =
      e.start || e.end
        ? `${e.start ? clock(e.start) : '?'} – ${e.end ? clock(e.end) : '?'}${
            e.breakHours ? ` · ${hoursToMinutes(e.breakHours)} min break` : ''
          }`
        : '';
    return {
      key: b.date,
      label: twoLine ? DAY_NAMES[weekdayIndex(b.date)].slice(0, 3) : md(b.date),
      sub: twoLine ? md(b.date) : undefined,
      segments: [
        { value: b.onSite, color: c.onSite },
        { value: b.remote, color: c.remote },
        { value: b.timeOff, color: c.timeOff },
      ],
      title: formatLongDate(b.date),
      note:
        [e.holiday, times].filter(Boolean).join(' · ') || (b.total ? undefined : 'No hours logged'),
      rows: b.total
        ? [
            ...(b.onSite || b.total === b.onSite
              ? [{ label: 'On site', value: formatHours(b.onSite), color: c.onSite }]
              : []),
            ...(b.remote
              ? [{ label: 'Remote / outside', value: formatHours(b.remote), color: c.remote }]
              : []),
            ...(b.timeOff
              ? [
                  {
                    label: `Time off${e.timeOffType ? ` (${e.timeOffType})` : ''}`,
                    value: formatHours(b.timeOff),
                    color: c.timeOff,
                  },
                ]
              : []),
          ]
        : [],
      footer: b.total ? `Total ${formatHours(b.total)} h` : undefined,
    };
  });

  const weekChart: ChartBar[] = weekBars(entries, range).map((w) => ({
    key: w.monday,
    label: md(w.monday),
    segments: [{ value: w.hours, color: c.onSite }],
    title: `Week of ${formatWeekRange(w.monday)}`,
    rows: [
      { label: 'Hours', value: formatHours(w.hours) },
      { label: 'Days worked', value: String(w.daysWorked) },
      { label: 'Avg / day', value: w.daysWorked ? formatHours(w.avgPerDay) : '—' },
      ...(w.timeOffHours ? [{ label: 'Time off', value: formatHours(w.timeOffHours) }] : []),
    ],
    footer: w.hours >= target ? '✓ Target met' : `${formatHours(target - w.hours)} h under target`,
  }));

  const stats = [
    { label: 'Range', value: `${withYear(range.from)} – ${withYear(range.to)}` },
    { label: 'Total hours', value: formatHours(summary.hours) },
    { label: 'Days worked', value: String(summary.daysWorked) },
    { label: 'Avg / day', value: summary.daysWorked ? formatHours(summary.avgPerDay) : '—' },
    { label: 'Time off', value: `${formatHours(summary.timeOffHours)} h` },
    ...(pay ? [{ label: 'Estimated pay', value: formatMoney(pay.total) }] : []),
  ];

  return (
    <Screen wide={wide}>
      <AppText variant="display" accessibilityRole="header">
        Charts
      </AppText>
      {ready ? (
        <>
          <RangePicker
            preset={preset}
            range={range}
            onPreset={(p) => {
              // Custom starts from the dates on screen.
              if (p === 'custom') setCustom(range);
              setPreset(p);
            }}
            onCustom={(from, to) => {
              setCustom(orderedRange(from, to));
              setPreset('custom');
            }}
          />
          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.stats}>
              {stats.map((s) => (
                <View
                  key={s.label}
                  style={styles.stat}
                  accessible
                  accessibilityLabel={`${s.label}: ${s.value}`}>
                  <AppText variant="caption" tone="muted">
                    {s.label}
                  </AppText>
                  <AppText variant="number">{s.value}</AppText>
                </View>
              ))}
            </View>
            {pay ? (
              <AppText variant="caption" tone="muted">
                Estimated pay: {payBreakdown(pay)}. {PAY_NOTE}
              </AppText>
            ) : null}
            <View style={[styles.charts, wide && styles.chartsWide]}>
              <View style={wide ? styles.dayWide : undefined}>
                <ColumnChart
                  title="Hours per day"
                  bars={dayChart}
                  reference={requiredHours}
                  legend={[
                    { label: 'On site', color: c.onSite },
                    { label: 'Remote / outside', color: c.remote },
                    { label: 'Time off', color: c.timeOff },
                    {
                      label: `Required (${formatHours(requiredHours).replace(/\.?0+$/, '')} h)`,
                      color: c.reference,
                      dashed: true,
                    },
                  ]}
                />
              </View>
              <View style={wide ? styles.weekWide : undefined}>
                <ColumnChart
                  title="Hours per week"
                  bars={weekChart}
                  reference={target}
                  allValues={weekChart.length <= 16}
                  legend={[
                    { label: 'Hours', color: c.onSite },
                    {
                      label: `Target (${formatHours(target).replace(/\.?0+$/, '')} h)`,
                      color: c.reference,
                      dashed: true,
                    },
                  ]}
                />
              </View>
            </View>
            <AppText variant="caption" tone="muted">
              {Platform.OS === 'web' ? 'Hover over or tap' : 'Tap'} a column to see its breakdown.
            </AppText>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.sm },
  stat: { gap: 2 },
  charts: { gap: space.lg },
  chartsWide: { flexDirection: 'row' },
  dayWide: { flex: 3 },
  weekWide: { flex: 2 },
});
