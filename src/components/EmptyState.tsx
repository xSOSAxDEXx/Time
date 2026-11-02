import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

type Props = {
  icon: ReactNode;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
};

/** What a screen shows before there's anything on it, and how to get started. */
export function EmptyState({ icon, title, body, action }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.badge, { backgroundColor: colors.surfaceSoft }]}>{icon}</View>
      <AppText variant="title" style={styles.center}>
        {title}
      </AppText>
      <AppText tone="muted" style={styles.center}>
        {body}
      </AppText>
      {action ? <Button variant="primary" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  center: { textAlign: 'center' },
});
