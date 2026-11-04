import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSettings, type Driving } from '@/store/settings';
import { findRoute } from '@/timecard/money';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { NumberField } from './NumberField';
import { Section } from './Section';
import { SelectField } from './SelectField';

/**
 * Settings → Driving (CLAUDE.md §3.13): the car's MPG, the gas price, a
 * reimbursement rate, the daily commute, and the miles between places
 * (entered once per route).
 */
export function DrivingSection() {
  const { colors } = useTheme();
  const driving = useSettings((s) => s.driving);
  const locations = useSettings((s) => s.locations);
  const set = (patch: Partial<Driving>) =>
    useSettings.getState().update({ driving: { ...useSettings.getState().driving, ...patch } });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const exists = !!from && !!to && !!findRoute(driving.routes, from, to);
  const canAdd = !!from && !!to && from !== to && !exists;

  return (
    <Section title="Driving">
      <AppText variant="caption" tone="muted">
        Drives between your places are logged as trips (by arrive and leave, or in the day editor).
        Their miles come from the routes below.
      </AppText>
      <View style={styles.grid}>
        {(
          [
            ['mpg', 'Miles per gallon', 'Your car’s miles per gallon', 'miles per gallon', 200],
            ['gasPrice', 'Gas $ per gallon', 'Gas price', 'dollars per gallon', 100],
            [
              'reimbursePerMile',
              'Reimbursed $ per mile',
              'Mileage reimbursement rate',
              'dollars per mile',
              10,
            ],
            [
              'commuteMiles',
              'Daily commute miles',
              'Daily commute, miles there and back',
              'miles',
              1000,
            ],
          ] as const
        ).map(([key, short, label, unit, max]) => (
          <View key={key} style={styles.cell}>
            <AppText variant="caption" tone="muted">
              {short}
            </AppText>
            <NumberField
              label={label}
              unit={unit}
              max={max}
              value={driving[key] ?? 0}
              onChange={(v) => set({ [key]: v || null })}
            />
          </View>
        ))}
      </View>
      <AppText variant="caption" tone="muted">
        Reimbursement is your employer&apos;s rate, or the IRS business mileage rate for the year.
        Leave it blank to skip it.
      </AppText>
      <AppText variant="caption" tone="muted">
        Daily commute is the miles from home to work and back. Gas for it is counted on each day you
        clock in, on the Money tab (not reimbursed). Remote days and time off don&apos;t count.
      </AppText>

      <AppText variant="label">Routes</AppText>
      {driving.routes.length === 0 ? (
        <AppText variant="caption" tone="muted">
          None yet. Add the miles between two places once (from your odometer or a maps app), and
          every trip between them uses it.
        </AppText>
      ) : null}
      {driving.routes.map((r) => (
        <View
          key={`${r.from}|${r.to}`}
          style={[
            styles.route,
            { borderColor: colors.border, backgroundColor: colors.surfaceSoft },
          ]}>
          <AppText style={styles.grow}>
            {r.from} ↔ {r.to}
          </AppText>
          <View style={styles.miles}>
            <NumberField
              label={`Miles between ${r.from} and ${r.to}`}
              unit="miles"
              max={5000}
              value={r.miles}
              onChange={(miles) =>
                set({ routes: driving.routes.map((x) => (x === r ? { ...x, miles } : x)) })
              }
            />
          </View>
          <Button
            variant="quiet"
            label="Remove"
            accessibilityLabel={`Remove the route between ${r.from} and ${r.to}`}
            onPress={() => set({ routes: driving.routes.filter((x) => x !== r) })}
          />
        </View>
      ))}
      <View style={[styles.add, { borderColor: colors.border }]}>
        <AppText variant="caption" tone="muted">
          Add a route
        </AppText>
        <View style={styles.pick}>
          <AppText variant="caption" tone="muted" style={styles.pickLabel}>
            From
          </AppText>
          <View style={styles.grow}>
            <SelectField label="Route from" options={locations} value={from} onChange={setFrom} />
          </View>
        </View>
        <View style={styles.pick}>
          <AppText variant="caption" tone="muted" style={styles.pickLabel}>
            To
          </AppText>
          <View style={styles.grow}>
            <SelectField
              label="Route to"
              options={locations.filter((l) => l !== from)}
              value={to}
              onChange={setTo}
            />
          </View>
        </View>
        {exists ? (
          <AppText variant="caption" tone="muted">
            That route is already in the list.
          </AppText>
        ) : null}
        <Button
          label="Add route"
          disabled={!canAdd}
          onPress={() => {
            set({ routes: [...driving.routes, { from, to, miles: 0 }] });
            setFrom('');
            setTo('');
          }}
        />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  pick: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pickLabel: { width: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { flexGrow: 1, flexBasis: 140, gap: space.xs },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  grow: { flex: 1 },
  miles: { width: 96 },
  add: { gap: space.sm, paddingTop: space.sm, borderTopWidth: 1 },
});
