import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TAP, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  options: string[];
  value: string;
  /** Tapping the selected chip again clears it (''). */
  onChange: (value: string) => void;
  label: string;
  /** Whether tapping the selected chip clears it (default true). */
  clearable?: boolean;
};

/** One-of-many choice as tappable chips. A saved value no longer in the list still shows. */
export function ChoiceChips({ options, value, onChange, label, clearable = true }: Props) {
  const { colors } = useTheme();
  const all = value && !options.includes(value) ? [...options, value] : options;
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {all.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(selected ? (clearable ? '' : option) : option)}
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityLabel={option}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected ? colors.accent : colors.surface,
                borderColor: selected ? colors.accent : colors.border,
              },
              pressed && styles.pressed,
            ]}>
            <AppText variant="label" style={selected && { color: colors.onAccent }}>
              {option}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: MIN_TAP,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pressed: { opacity: 0.7 },
});
