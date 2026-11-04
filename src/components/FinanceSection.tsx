import { StyleSheet, View } from 'react-native';

import {
  DEFAULT_FINANCE,
  PAY_SCHEDULES,
  useSettings,
  type AmountUnit,
  type Deduction,
  type Finance,
  type TaxKey,
} from '@/store/settings';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { BillsEditor, newId } from './BillsEditor';
import { Button } from './Button';
import { ChoiceChips } from './ChoiceChips';
import { NumberField } from './NumberField';
import { Labeled, Section } from './Section';
import { SwitchRow } from './SwitchRow';
import { TextField } from './TextField';

const UNITS: [Deduction['unit'], string][] = [
  ['percent', '% of pay'],
  ['paycheck', '$ per paycheck'],
  ['month', '$ per month'],
];

const TAXES = [
  ['federal', 'federalPct', 'Federal income tax'],
  ['state', 'statePct', 'State income tax'],
  ['local', 'localPct', 'Local or city tax'],
  ['fica', 'ficaPct', 'Social Security + Medicare'],
] as const satisfies readonly [TaxKey, keyof Finance, string][];

/** One-tap starting points for the common paycheck deductions. */
const DEDUCTION_PRESETS: Omit<Deduction, 'id' | 'amount'>[] = [
  { name: '401(k)', kind: 'retirement', unit: 'percent', pretax: true },
  { name: 'Roth 401(k)', kind: 'retirement', unit: 'percent', pretax: false },
  { name: 'Health insurance', kind: 'health', unit: 'paycheck', pretax: true },
  { name: 'Dental', kind: 'health', unit: 'paycheck', pretax: true },
  { name: 'Vision', kind: 'health', unit: 'paycheck', pretax: true },
  { name: 'HSA', kind: 'health', unit: 'paycheck', pretax: true },
  { name: 'Other deduction', kind: 'other', unit: 'paycheck', pretax: false },
];

/**
 * Settings → Finance and bills (CLAUDE.md §3.12): tax rates, paycheck
 * deductions and monthly bills, for the Money tab's estimates.
 */
export function FinanceSection() {
  const { colors } = useTheme();
  const finance = useSettings((s) => s.finance);
  const set = (patch: Partial<Finance>) =>
    useSettings.getState().update({ finance: { ...useSettings.getState().finance, ...patch } });
  const setDeduction = (id: string, patch: Partial<Deduction>) =>
    set({ deductions: finance.deductions.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const card = [styles.item, { borderColor: colors.border, backgroundColor: colors.surfaceSoft }];

  return (
    <Section title="Finance and bills">
      <AppText variant="caption" tone="muted">
        For the Money tab: what comes out of your pay and what&apos;s left after bills. Copy the
        rates from a recent pay stub. Estimates only, kept on this device.
      </AppText>

      <Labeled label="Paid">
        <ChoiceChips
          label="How often you're paid"
          clearable={false}
          options={PAY_SCHEDULES.map(([, l]) => l)}
          value={PAY_SCHEDULES.find(([k]) => k === finance.paySchedule)?.[1] ?? 'Every 2 weeks'}
          onChange={(l) =>
            set({
              paySchedule:
                PAY_SCHEDULES.find(([, x]) => x === l)?.[0] ?? DEFAULT_FINANCE.paySchedule,
            })
          }
        />
      </Labeled>

      <AppText variant="label">Taxes</AppText>
      {TAXES.map(([key, field, label]) => {
        const unit: AmountUnit = finance.taxUnits?.[key] ?? 'percent';
        return (
          <View key={key} style={card}>
            <View style={styles.row}>
              <AppText variant="bodyStrong" style={styles.grow}>
                {label}
              </AppText>
              <View style={styles.amount}>
                <NumberField
                  label={`${label} amount`}
                  unit={unit === 'percent' ? 'percent' : 'dollars'}
                  max={unit === 'percent' ? 100 : 1_000_000}
                  value={finance[field]}
                  onChange={(v) => set({ [field]: v })}
                />
              </View>
            </View>
            <ChoiceChips
              label={`${label}: how it's given`}
              clearable={false}
              options={UNITS.map(([, l]) => l)}
              value={UNITS.find(([k]) => k === unit)?.[1] ?? UNITS[0][1]}
              onChange={(l) => {
                const next = UNITS.find(([, x]) => x === l)?.[0] ?? unit;
                if (next === unit) return;
                // A % and a dollar amount don't convert, so switching starts it at 0.
                const was = unit === 'percent';
                const now = next === 'percent';
                set({
                  taxUnits: { ...finance.taxUnits, [key]: next },
                  ...(was !== now ? { [field]: 0 } : {}),
                });
              }}
            />
          </View>
        );
      })}
      <AppText variant="caption" tone="muted">
        Copy each tax from a recent pay stub: the dollar amount per paycheck, or the % (tax ÷ gross
        pay). A % follows your hours; a dollar amount stays the same each paycheck. Social Security
        + Medicare is 7.65% for most people.
      </AppText>

      <AppText variant="label">Paycheck deductions</AppText>
      {finance.deductions.length === 0 ? (
        <AppText variant="caption" tone="muted">
          None yet. Add retirement, health insurance and anything else taken out of your pay.
        </AppText>
      ) : null}
      {finance.deductions.map((d) => (
        <View key={d.id} style={card}>
          <View style={styles.row}>
            <View style={styles.grow}>
              <TextField
                label="Deduction name"
                value={d.name}
                onChange={(name) => setDeduction(d.id, { name: name || d.name })}
              />
            </View>
            <View style={styles.amount}>
              <NumberField
                label={`${d.name} amount`}
                unit={d.unit === 'percent' ? 'percent' : 'dollars'}
                max={d.unit === 'percent' ? 100 : 1_000_000}
                value={d.amount}
                onChange={(amount) => setDeduction(d.id, { amount })}
              />
            </View>
          </View>
          <ChoiceChips
            label={`${d.name}: how it's taken`}
            clearable={false}
            options={UNITS.map(([, l]) => l)}
            value={UNITS.find(([k]) => k === d.unit)?.[1] ?? UNITS[0][1]}
            onChange={(l) =>
              setDeduction(d.id, { unit: UNITS.find(([, x]) => x === l)?.[0] ?? d.unit })
            }
          />
          <SwitchRow
            label="Before tax"
            description={
              d.kind === 'retirement'
                ? 'Lowers income tax (traditional 401(k), 403(b)). Roth is after tax.'
                : 'Lowers income tax, Social Security and Medicare (most health plans, HSA).'
            }
            value={d.pretax}
            onChange={(pretax) => setDeduction(d.id, { pretax })}
          />
          <Button
            variant="quiet"
            label="Remove"
            accessibilityLabel={`Remove ${d.name}`}
            onPress={() => set({ deductions: finance.deductions.filter((x) => x.id !== d.id) })}
          />
        </View>
      ))}
      <View style={styles.wrap}>
        {DEDUCTION_PRESETS.map((p) => (
          <Button
            key={p.name}
            label={`+ ${p.name}`}
            accessibilityLabel={`Add ${p.name}`}
            onPress={() =>
              set({ deductions: [...finance.deductions, { ...p, id: newId(), amount: 0 }] })
            }
          />
        ))}
      </View>

      <AppText variant="label">Bills</AppText>
      <BillsEditor
        bills={finance.bills}
        onChange={(bills) => set({ bills })}
        emptyNote="None yet. Add what you pay every month from your take-home pay."
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  item: { gap: space.sm, padding: space.sm, borderRadius: radius.md, borderWidth: 1 },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  grow: { flex: 1 },
  amount: { width: 110 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
