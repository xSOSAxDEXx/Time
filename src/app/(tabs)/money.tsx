import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ColumnChart, type ChartBar } from '@/components/ColumnChart';
import { EmptyState } from '@/components/EmptyState';
import { partnerName } from '@/components/PartnerSection';
import { DollarIcon } from '@/components/icons';
import { Screen } from '@/components/Screen';
import { StatCard } from '@/components/StatCard';
import { useHydrated } from '@/hooks/useHydrated';
import { usePayRule } from '@/hooks/usePayRule';
import { useTimeCard } from '@/hooks/useTimeCard';
import { useToday } from '@/hooks/useToday';
import { useEntries } from '@/store/entries';
import { DEFAULT_PARTNER, useSettings } from '@/store/settings';
import { addDays, fromKey, mondayOf } from '@/timecard/dates';
import {
  firstLoggedDay,
  formatDollars,
  formatMiles,
  MONEY_NOTE,
  totalMoney,
  yearMoney,
  type DrivingTotals,
  type Money,
  type MonthMoney,
} from '@/timecard/money';
import { formatMoney, showsPay } from '@/timecard/pay';
import { radius, space, useTheme, WIDE_BREAKPOINT } from '@/theme';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** What came off, for a note under take-home. */
const offNote = (m: Money) =>
  `Taxes ${formatDollars(m.taxes)} · deductions ${formatDollars(m.deductions)}`;
const billsNote = (m: Money) =>
  `Bills ${formatDollars(m.bills + m.partnerBills)}${m.gas ? ` · gas ${formatDollars(m.gas)}` : ''}`;
/** A month's miles: drives and the daily commute. */
const monthMiles = (m: MonthMoney) => (m.driving ? m.driving.miles + m.driving.commuteMiles : 0);
/** All the bills and gas that come out of take-home. */
const spending = (m: Money) => m.bills + m.partnerBills + m.gas;

/**
 * Money (CLAUDE.md §3.12–3.13): each month's estimated pay, what comes off
 * it, and what's left after bills and gas; plus miles driven.
 */
export default function MoneyScreen() {
  const { colors } = useTheme();
  const today = useToday();
  const thisYear = fromKey(today).getFullYear();
  const [year, setYear] = useState(thisYear);
  const entriesReady = useHydrated(useEntries);
  const settingsReady = useHydrated(useSettings);
  const ready = entriesReady && settingsReady;
  const rule = usePayRule();
  const finance = useSettings((s) => s.finance);
  const driving = useSettings((s) => s.driving);
  const partner = useSettings((s) => s.partner) ?? DEFAULT_PARTNER;
  const withPartner = partner.enabled;
  const who = partnerName(partner);
  const allEntries = useEntries((s) => s.entries);
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= WIDE_BREAKPOINT;

  // Whole weeks either side of the year, so overtime adds up by week.
  const { entries } = useTimeCard(mondayOf(`${year}-01-01`), addDays(mondayOf(`${year}-12-31`), 6));
  const first = useMemo(() => firstLoggedDay(allEntries), [allEntries]);
  const months = useMemo(
    () => yearMoney(entries, year, today, rule, finance, driving, first, partner),
    [entries, year, today, rule, finance, driving, first, partner],
  );
  const total = totalMoney(months);
  const now = year === thisYear ? months[fromKey(today).getMonth()] : null;
  const c = colors.chart;

  if (!ready) return <Screen>{null}</Screen>;

  if (!showsPay(rule)) {
    return (
      <Screen>
        <AppText variant="display" accessibilityRole="header">
          Money
        </AppText>
        <EmptyState
          icon={<DollarIcon color={colors.accent} size={32} />}
          title="Add your hourly rate"
          body="Money works from your pay estimate. Set an hourly rate in Settings → Pay, then add taxes, deductions and bills under Finance and bills."
          action={{ label: 'Go to Settings', onPress: () => router.navigate('/settings') }}
        />
      </Screen>
    );
  }

  const bars: ChartBar[] = months.map((m, i) => {
    const money = m.money;
    const short = MONTHS[i].slice(0, 3);
    if (!money) {
      return {
        key: m.month,
        label: short,
        segments: [],
        title: `${MONTHS[i]} ${year}`,
        note: 'Nothing to count',
        rows: [],
      };
    }
    // Take-home (with a partner's) splits into bills and gas, and what's left;
    // short months show the gap.
    const spent = Math.min(Math.max(0, money.takeHome + money.partnerTakeHome), spending(money));
    const left = Math.max(0, money.leftOver);
    return {
      key: m.month,
      label: short,
      segments: [
        { value: left, color: c.remote },
        { value: spent, color: c.onSite },
        { value: money.deductions, color: c.other },
        { value: money.taxes, color: c.timeOff },
      ],
      title: `${MONTHS[i]} ${year}${m.share < 0.999 ? ' (so far)' : ''}`,
      rows: [
        { label: 'Gross pay', value: formatMoney(money.gross) },
        { label: 'Taxes', value: formatMoney(money.taxes), color: c.timeOff },
        { label: 'Deductions', value: formatMoney(money.deductions), color: c.other },
        { label: 'Take-home', value: formatMoney(money.takeHome) },
        ...(withPartner
          ? [{ label: `${who}'s take-home`, value: formatMoney(money.partnerTakeHome) }]
          : []),
        { label: 'Bills and gas', value: formatMoney(spending(money)), color: c.onSite },
      ],
      footer:
        money.leftOver >= 0
          ? `Left over ${formatMoney(money.leftOver)}`
          : `Short by ${formatMoney(-money.leftOver)}`,
    };
  });

  const driveCards = (label: string, d: DrivingTotals | null) =>
    d && (d.trips || d.commuteMiles)
      ? [
          <StatCard
            key={`${label}-miles`}
            label={`Miles ${label}`}
            value={formatMiles(d.miles + d.commuteMiles)}
            note={[
              d.trips ? `${d.trips} ${d.trips === 1 ? 'drive' : 'drives'}` : '',
              d.commuteMiles
                ? `commute ${formatMiles(d.commuteMiles)} (${d.commuteDays} ${d.commuteDays === 1 ? 'day' : 'days'})`
                : '',
              d.unknownTrips ? `${d.unknownTrips} without miles` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
            noteTone={d.unknownTrips ? 'warn' : 'muted'}
          />,
          ...(d.gas != null
            ? [
                <StatCard
                  key={`${label}-gas`}
                  label={`Gas ${label}`}
                  value={formatDollars(d.gas)}
                />,
              ]
            : []),
          ...(d.reimbursement != null
            ? [
                <StatCard
                  key={`${label}-reimb`}
                  label={`Reimbursement ${label}`}
                  value={formatDollars(d.reimbursement)}
                  note="If your employer pays mileage"
                />,
              ]
            : []),
        ]
      : [];

  const y = total.money;
  const hasDriving = total.driving.trips > 0 || total.driving.commuteMiles > 0;
  const leftLabel = withPartner ? `Left over with ${who}` : 'Left over';
  const partnerCard = (m: Money) =>
    withPartner ? (
      <StatCard
        label={`${who}'s take-home`}
        value={formatDollars(m.partnerTakeHome)}
        note={m.partnerBills ? `Their bills ${formatDollars(m.partnerBills)}` : undefined}
      />
    ) : null;

  return (
    <Screen wide={wide}>
      <AppText variant="display" accessibilityRole="header">
        Money
      </AppText>

      <View style={styles.yearRow}>
        <Button label="‹" accessibilityLabel="Previous year" onPress={() => setYear(year - 1)} />
        <AppText
          variant="title"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={styles.yearText}>
          {year}
        </AppText>
        <Button
          label="›"
          accessibilityLabel="Next year"
          disabled={year >= thisYear}
          onPress={() => setYear(year + 1)}
        />
      </View>

      {now?.money ? (
        <>
          <AppText variant="label" tone="muted">
            {MONTHS[fromKey(today).getMonth()]} so far
          </AppText>
          <View style={styles.grid}>
            <StatCard label="Gross pay" value={formatDollars(now.money.gross)} />
            <StatCard
              label="Take-home"
              value={formatDollars(now.money.takeHome)}
              note={offNote(now.money)}
            />
            {partnerCard(now.money)}
            <StatCard
              label={leftLabel}
              value={formatDollars(now.money.leftOver)}
              note={billsNote(now.money)}
              noteTone={now.money.leftOver < 0 ? 'warn' : 'muted'}
            />
            {driveCards('this month', now.driving)}
          </View>
        </>
      ) : null}

      <AppText variant="label" tone="muted">
        {year === thisYear ? 'This year so far' : `All of ${year}`}
      </AppText>
      <View style={styles.grid}>
        <StatCard label="Gross pay" value={formatDollars(y.gross)} />
        <StatCard label="Take-home" value={formatDollars(y.takeHome)} note={offNote(y)} />
        {partnerCard(y)}
        <StatCard
          label={leftLabel}
          value={formatDollars(y.leftOver)}
          note={billsNote(y)}
          noteTone={y.leftOver < 0 ? 'warn' : 'muted'}
        />
        <StatCard
          label="Taxes"
          value={formatDollars(y.taxes)}
          note={`Federal ${formatDollars(y.federal)} · state ${formatDollars(y.state)}${
            y.local ? ` · local ${formatDollars(y.local)}` : ''
          } · Soc. Sec. + Medicare ${formatDollars(y.fica)}`}
        />
        {hasDriving ? driveCards('this year', total.driving) : null}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ColumnChart
          title="Pay by month"
          unit="money"
          bars={bars}
          reference={0}
          allValues={wide}
          legend={[
            { label: 'Left over', color: c.remote },
            { label: 'Bills and gas', color: c.onSite },
            { label: 'Deductions', color: c.other },
            { label: 'Taxes', color: c.timeOff },
          ]}
        />
        <AppText variant="caption" tone="muted">
          Each column is the month&apos;s gross pay
          {withPartner ? ` plus ${who}'s take-home` : ''}.{' '}
          {Platform.OS === 'web' ? 'Hover over or tap' : 'Tap'} a column for its breakdown.
        </AppText>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText variant="title" accessibilityRole="header">
          Months
        </AppText>
        <View style={styles.tableHead}>
          <AppText variant="caption" tone="muted" style={styles.monthCol}>
            Month
          </AppText>
          {['Gross', 'Take-home', withPartner ? 'Left (both)' : 'Left over'].map((h) => (
            <AppText key={h} variant="caption" tone="muted" style={styles.num}>
              {h}
            </AppText>
          ))}
        </View>
        {months.map((m, i) =>
          m.money ? (
            <View
              key={m.month}
              accessible
              accessibilityLabel={`${MONTHS[i]}: gross ${formatDollars(m.money.gross)}, take-home ${formatDollars(m.money.takeHome)}, ${leftLabel.toLowerCase()} ${formatDollars(m.money.leftOver)}${monthMiles(m) ? `, ${formatMiles(monthMiles(m))}` : ''}`}
              style={[styles.tableRow, { borderColor: colors.border }]}>
              <View style={styles.monthCol}>
                <AppText variant="bodyStrong">{MONTHS[i].slice(0, 3)}</AppText>
                {monthMiles(m) ? (
                  <AppText variant="caption" tone="muted">
                    {formatMiles(monthMiles(m))}
                  </AppText>
                ) : null}
              </View>
              <AppText variant="number" style={styles.num}>
                {formatDollars(m.money.gross)}
              </AppText>
              <AppText variant="number" style={styles.num}>
                {formatDollars(m.money.takeHome)}
              </AppText>
              <AppText
                variant="number"
                tone={m.money.leftOver < 0 ? 'warn' : 'primary'}
                style={styles.num}>
                {formatDollars(m.money.leftOver)}
              </AppText>
            </View>
          ) : null,
        )}
        {months.every((m) => !m.money) ? (
          <AppText tone="muted">Nothing logged in {year}.</AppText>
        ) : null}
      </View>

      <AppText variant="caption" tone="muted">
        {MONEY_NOTE} Bills and fixed deductions are spread evenly over the year; the current month
        counts only the days so far. Gas includes your daily commute on each day you clocked in.
        {withPartner ? ` Left over includes ${who}'s take-home and bills.` : ''} Set rates and bills
        in Settings → Finance and bills, Spouse or partner, and Driving.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, maxWidth: 360 },
  yearText: { flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: { gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  tableHead: { flexDirection: 'row', gap: space.sm },
  tableRow: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderTopWidth: 1,
  },
  monthCol: { width: 64 },
  num: { flex: 1, textAlign: 'right' },
});
