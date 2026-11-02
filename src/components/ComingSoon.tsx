import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { radius, space, useTheme } from '@/theme';

/** Placeholder for a screen that arrives in a later build step. */
export function ComingSoon({
  title,
  step,
  children,
}: {
  title: string;
  step: number;
  children: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText variant="bodyStrong">{title}</AppText>
      <AppText tone="muted">{children}</AppText>
      <AppText variant="caption" tone="muted">
        Coming in build step {step}.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.sm },
});
