import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSettings } from '@/store/settings';
import { driveCosts, findRoute, formatMiles, tripMiles } from '@/timecard/money';
import { formatMoney } from '@/timecard/pay';
import type { Entry, Trip } from '@/timecard/types';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { NumberField } from './NumberField';
import { SelectField } from './SelectField';

type Props = {
  entry: Entry;
  onChange: (patch: Pick<Entry, 'trips'> & Partial<Pick<Entry, 'travel'>>) => void;
};

/**
 * A day's drives between places (CLAUDE.md §3.13). Miles come from the
 * saved route; typing miles for a trip with no route saves the route too,
 * so the next trip between those places already knows.
 */
export function TripsEditor({ entry, onChange }: Props) {
  const { colors } = useTheme();
  const locations = useSettings((s) => s.locations);
  const driving = useSettings((s) => s.driving);
  const trips = entry.trips ?? [];
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const setMiles = (i: number, miles: number) => {
    const t = trips[i];
    const route = findRoute(driving.routes, t.from, t.to);
    if (!route || route.miles === 0) {
      // First time on this route: remember it for every trip.
      const routes = route
        ? driving.routes.map((r) => (r === route ? { ...r, miles } : r))
        : [...driving.routes, { from: t.from, to: t.to, miles }];
      useSettings.getState().update({ driving: { ...driving, routes } });
      const { miles: _old, ...rest } = t;
      onChange({ trips: trips.map((x, j) => (j === i ? rest : x)) });
    } else {
      // Different from the usual route this time (a detour): just this trip.
      const next: Trip = miles === route.miles ? { from: t.from, to: t.to } : { ...t, miles };
      onChange({ trips: trips.map((x, j) => (j === i ? next : x)) });
    }
  };

  return (
    <View style={styles.wrap}>
      {trips.length === 0 ? (
        <AppText variant="caption" tone="muted">
          No drives logged. Arrive and leave adds them on Android, or add one here.
        </AppText>
      ) : null}
      {trips.map((t, i) => {
        const miles = tripMiles(t, driving.routes);
        const { gas, reimbursement } = driveCosts(miles ?? 0, driving);
        const costs = [
          gas != null && miles != null ? `${formatMoney(gas)} gas` : '',
          reimbursement != null && miles != null ? `${formatMoney(reimbursement)} reimbursed` : '',
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <View
            key={`${i}-${t.from}-${t.to}`}
            style={[styles.trip, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.text}>
              <AppText variant="bodyStrong">
                {t.from} → {t.to}
              </AppText>
              <AppText variant="caption" tone={miles == null ? 'warn' : 'muted'}>
                {miles == null
                  ? 'Type the miles once; the route is saved'
                  : [formatMiles(miles), costs].filter(Boolean).join(' · ')}
              </AppText>
            </View>
            <View style={styles.miles}>
              <NumberField
                label={`Miles from ${t.from} to ${t.to}`}
                unit="miles"
                max={5000}
                value={miles ?? 0}
                onChange={(m) => setMiles(i, m)}
              />
            </View>
            <Button
              variant="quiet"
              label="Remove"
              accessibilityLabel={`Remove the drive from ${t.from} to ${t.to}`}
              onPress={() => onChange({ trips: trips.filter((_, j) => j !== i) })}
            />
          </View>
        );
      })}
      <View style={styles.pick}>
        <AppText variant="caption" tone="muted" style={styles.pickLabel}>
          From
        </AppText>
        <View style={styles.grow}>
          <SelectField label="Drive from" options={locations} value={from} onChange={setFrom} />
        </View>
      </View>
      <View style={styles.pick}>
        <AppText variant="caption" tone="muted" style={styles.pickLabel}>
          To
        </AppText>
        <View style={styles.grow}>
          <SelectField
            label="Drive to"
            options={locations.filter((l) => l !== from)}
            value={to}
            onChange={setTo}
          />
        </View>
      </View>
      <Button
        label="Add drive"
        disabled={!from || !to || from === to}
        onPress={() => {
          onChange({
            trips: [...trips, { from, to }],
            ...(entry.travel ? {} : { travel: 'Yes' as const }),
          });
          setFrom('');
          setTo('');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pick: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pickLabel: { width: 40 },
  grow: { flex: 1 },
  wrap: { gap: space.sm },
  trip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  text: { flex: 1, gap: 2 },
  miles: { width: 88 },
});
