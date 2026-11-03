import { StyleSheet, View } from 'react-native';

import { DEFAULT_PARTNER, useSettings, type Partner } from '@/store/settings';
import { perMonth } from '@/timecard/money';
import { formatMoney } from '@/timecard/pay';
import { space } from '@/theme';

import { AppText } from './AppText';
import { BillsEditor } from './BillsEditor';
import { ChoiceChips } from './ChoiceChips';
import { SCHEDULES } from './FinanceSection';
import { NumberField } from './NumberField';
import { Labeled, Section } from './Section';
import { SwitchRow } from './SwitchRow';
import { TextField } from './TextField';

/** "Partner", or the name they gave. */
export const partnerName = (p: Partner) => p.name.trim() || 'Partner';

/**
 * Settings → Spouse or partner (owner request, 3 Nov 2026): their take-home
 * pay and bills, added to yours on the Money tab while it's turned on.
 */
export function PartnerSection() {
  const partner = useSettings((s) => s.partner) ?? DEFAULT_PARTNER;
  const set = (patch: Partial<Partner>) =>
    useSettings.getState().update({
      partner: { ...(useSettings.getState().partner ?? DEFAULT_PARTNER), ...patch },
    });
  const who = partnerName(partner);
  const whose = `${who}'s`;

  return (
    <Section title="Spouse or partner">
      <AppText variant="caption" tone="muted">
        Add a spouse or partner&apos;s take-home pay and bills to see what&apos;s left over for the
        two of you on the Money tab. Turn it off to see just yours; what you enter here is kept.
      </AppText>
      <SwitchRow
        label="Include in Money"
        description="Adds their take-home pay and bills to yours."
        value={partner.enabled}
        onChange={(enabled) => set({ enabled })}
      />
      <Labeled label="Name">
        <TextField
          label="Spouse or partner's name"
          placeholder="Partner"
          value={partner.name}
          onChange={(name) => set({ name })}
        />
      </Labeled>
      <View style={styles.row}>
        <AppText variant="bodyStrong" style={styles.grow}>
          Take-home per paycheck
        </AppText>
        <View style={styles.amount}>
          <NumberField
            label={`${whose} take-home pay per paycheck`}
            unit="dollars"
            max={1_000_000}
            value={partner.takeHome}
            onChange={(takeHome) => set({ takeHome })}
          />
        </View>
      </View>
      <Labeled label="Paid">
        <ChoiceChips
          label={`How often ${who} is paid`}
          clearable={false}
          options={SCHEDULES.map(([, l]) => l)}
          value={SCHEDULES.find(([k]) => k === partner.paySchedule)?.[1] ?? 'Every 2 weeks'}
          onChange={(l) =>
            set({
              paySchedule: SCHEDULES.find(([, x]) => x === l)?.[0] ?? DEFAULT_PARTNER.paySchedule,
            })
          }
        />
      </Labeled>
      <AppText variant="caption" tone="muted">
        The amount on their paycheck after taxes and deductions
        {partner.takeHome
          ? `: about ${formatMoney(perMonth(partner.takeHome, 'paycheck', partner.paySchedule))} a month`
          : ''}
        .
      </AppText>

      <AppText variant="label">{whose} bills</AppText>
      <BillsEditor
        bills={partner.bills}
        onChange={(bills) => set({ bills })}
        whose={whose}
        emptyNote="None yet. Add bills they pay. Shared bills only need adding once, in yours or theirs."
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  grow: { flex: 1 },
  amount: { width: 120 },
});
