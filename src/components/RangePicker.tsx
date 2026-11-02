import { StyleSheet, View } from 'react-native';

import { RANGE_PRESETS, type DateRange, type RangePreset } from '@/timecard/charts';
import { formatShortDate, fromKey } from '@/timecard/dates';
import { space } from '@/theme';

import { AppText } from './AppText';
import { ChoiceChips } from './ChoiceChips';
import { DateField } from './DateField';

const OPTIONS = [...RANGE_PRESETS, { value: 'custom' as const, label: 'Custom' }];

type Props = {
  preset: RangePreset;
  range: DateRange;
  onPreset: (preset: RangePreset) => void;
  /** Picking either date switches to a custom range. */
  onCustom: (from: string, to: string) => void;
};

const withYear = (key: string) => `${formatShortDate(key)}, ${fromKey(key).getFullYear()}`;

/** The chart date range (CLAUDE.md §3.5): a preset, or custom from/to dates. */
export function RangePicker({ preset, range, onPreset, onCustom }: Props) {
  const current = OPTIONS.find((o) => o.value === preset) ?? OPTIONS[0];
  return (
    <View style={styles.root}>
      <ChoiceChips
        label="Date range"
        clearable={false}
        options={OPTIONS.map((o) => o.label)}
        value={current.label}
        onChange={(label) => {
          const picked = OPTIONS.find((o) => o.label === label);
          if (picked) onPreset(picked.value);
        }}
      />
      <View style={styles.dates}>
        <View style={styles.date}>
          <AppText variant="label" tone="muted">
            From
          </AppText>
          <DateField
            label="From date"
            buttonLabel={withYear(range.from)}
            value={range.from}
            onChange={(from) => onCustom(from, range.to)}
          />
        </View>
        <View style={styles.date}>
          <AppText variant="label" tone="muted">
            To
          </AppText>
          <DateField
            label="To date"
            buttonLabel={withYear(range.to)}
            value={range.to}
            onChange={(to) => onCustom(range.from, to)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  dates: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  date: { gap: space.xs },
});
