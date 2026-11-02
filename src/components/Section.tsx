import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

/** Lets a screen's "Jump to" links find each section (title → position). */
export const SectionPositions = createContext<((title: string, y: number) => void) | null>(null);

/** A titled card on the Settings screen. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  const report = useContext(SectionPositions);
  return (
    <View
      onLayout={report ? (e) => report(title, e.nativeEvent.layout.y) : undefined}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.heading}>
        <View style={[styles.accent, { backgroundColor: colors.accent }]} />
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}

/** A labelled field inside a section. */
export function Labeled({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
      {children}
      {note ? (
        <AppText variant="caption" tone="muted">
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  field: { gap: space.xs },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  accent: { width: 4, height: 20, borderRadius: 2 },
});
