import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { radius, space, type, useTheme } from '@/theme';

type Props = {
  value: number;
  /** Called with the new number once editing finishes (blur or done). */
  onChange: (value: number) => void;
  label: string;
  /** Shown after the number for screen readers, e.g. "minutes". */
  unit: string;
  compact?: boolean;
  max?: number;
};

function show(n: number): string {
  return n ? String(Math.round(n * 100) / 100) : '';
}

/**
 * A number typed with the keypad. Blank means 0. Text that isn't a number,
 * or is negative or above `max`, is ignored and the old value comes back.
 */
export function NumberField({ value, onChange, label, unit, compact, max = 24 * 60 }: Props) {
  const { colors } = useTheme();
  // What's being typed; null when not editing, so the saved value shows.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft == null) return;
    const trimmed = draft.trim().replace(',', '.');
    const n = trimmed === '' ? 0 : Number(trimmed);
    setDraft(null);
    if (Number.isFinite(n) && n >= 0 && n <= max && n !== value) onChange(n);
  };

  return (
    <TextInput
      value={draft ?? show(value)}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      inputMode="decimal"
      keyboardType="decimal-pad"
      returnKeyType="done"
      placeholder="0"
      placeholderTextColor={colors.textMuted}
      accessibilityLabel={`${label}, in ${unit}`}
      selectTextOnFocus
      style={[
        type.number,
        styles.input,
        compact && styles.compact,
        { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    minWidth: 88,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    textAlign: 'right',
  },
  compact: { minHeight: 40, minWidth: 56, width: 56, paddingHorizontal: space.sm },
});
