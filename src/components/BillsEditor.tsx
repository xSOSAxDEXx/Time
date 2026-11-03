import { StyleSheet, View } from 'react-native';

import type { Bill } from '@/store/settings';
import { perMonth } from '@/timecard/money';
import { formatMoney } from '@/timecard/pay';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { ChoiceChips } from './ChoiceChips';
import { NumberField } from './NumberField';
import { TextField } from './TextField';

const PERS: [Bill['per'], string][] = [
  ['week', 'Weekly'],
  ['month', 'Monthly'],
  ['year', 'Yearly'],
];

const BILL_PRESETS = [
  'Rent / mortgage',
  'Car payment',
  'Car insurance',
  'Phone',
  'Internet',
  'Utilities',
  'Other bill',
];

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

type Props = {
  bills: Bill[];
  onChange: (bills: Bill[]) => void;
  /** Whose bills, for screen readers when there are two lists, e.g. "Sam's". */
  whose?: string;
  emptyNote: string;
};

/** A list of bills (name, amount, how often), with one-tap presets and the monthly total. */
export function BillsEditor({ bills, onChange, whose, emptyNote }: Props) {
  const { colors } = useTheme();
  const card = [styles.item, { borderColor: colors.border, backgroundColor: colors.surfaceSoft }];
  const of = whose ? ` (${whose})` : '';
  const setBill = (id: string, patch: Partial<Bill>) =>
    onChange(bills.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const monthly = bills.reduce((sum, b) => sum + perMonth(b.amount, b.per, 'monthly'), 0);

  return (
    <>
      {bills.length === 0 ? (
        <AppText variant="caption" tone="muted">
          {emptyNote}
        </AppText>
      ) : null}
      {bills.map((b) => (
        <View key={b.id} style={card}>
          <View style={styles.row}>
            <View style={styles.grow}>
              <TextField
                label={`Bill name${of}`}
                value={b.name}
                onChange={(name) => setBill(b.id, { name: name || b.name })}
              />
            </View>
            <View style={styles.amount}>
              <NumberField
                label={`${b.name} amount${of}`}
                unit="dollars"
                max={1_000_000}
                value={b.amount}
                onChange={(amount) => setBill(b.id, { amount })}
              />
            </View>
          </View>
          <ChoiceChips
            label={`${b.name}${of}: how often`}
            clearable={false}
            options={PERS.map(([, l]) => l)}
            value={PERS.find(([k]) => k === b.per)?.[1] ?? 'Monthly'}
            onChange={(l) => setBill(b.id, { per: PERS.find(([, x]) => x === l)?.[0] ?? b.per })}
          />
          <Button
            variant="quiet"
            label="Remove"
            accessibilityLabel={`Remove ${b.name}${of}`}
            onPress={() => onChange(bills.filter((x) => x.id !== b.id))}
          />
        </View>
      ))}
      <View style={styles.wrap}>
        {BILL_PRESETS.map((name) => (
          <Button
            key={name}
            label={`+ ${name}`}
            accessibilityLabel={`Add ${name}${of}`}
            onPress={() => onChange([...bills, { id: newId(), name, amount: 0, per: 'month' }])}
          />
        ))}
      </View>
      {bills.length ? (
        <AppText variant="caption" tone="muted">
          Bills come to {formatMoney(monthly)} a month.
        </AppText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  item: { gap: space.sm, padding: space.sm, borderRadius: radius.md, borderWidth: 1 },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  grow: { flex: 1 },
  amount: { width: 110 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
