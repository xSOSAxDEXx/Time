import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  value: string;
  /** A short line under the value. */
  note?: string;
  noteTone?: 'muted' | 'good' | 'warn' | 'accent';
};

/** One headline number (CLAUDE.md §3.4). Read out as a single item. */
export function StatCard({ label, value, note, noteTone = 'muted' }: Props) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={[label, value, note].filter(Boolean).join(': ').replace('✓ ', '')}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="display">{value}</AppText>
      {note ? (
        <AppText variant="caption" tone={noteTone}>
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: 150,
    gap: 2,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
