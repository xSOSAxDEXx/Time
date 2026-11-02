import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { MIN_TAP, space, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

export function SwitchRow({ label, description, value, onChange }: Props) {
  const { colors } = useTheme();
  return (
    // The whole row toggles (a bigger target than the switch); screen readers
    // still land on the switch itself.
    <Pressable
      style={styles.row}
      onPress={() => onChange(!value)}
      accessible={false}
      focusable={false}>
      <View style={styles.text}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText variant="caption" tone="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        accessibilityHint={description}
        trackColor={{ true: colors.accent, false: colors.border }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: MIN_TAP },
  text: { flex: 1, gap: 2 },
});
