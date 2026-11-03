import { Platform, StyleSheet, View } from 'react-native';

import { useNow } from '@/hooks/useNow';
import { requestPermission } from '@/notifications/scheduler';
import { useReminderPlan, useReminderState } from '@/notifications/useReminder';
import { useSettings } from '@/store/settings';
import { formatClock, formatHours } from '@/timecard/dates';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

const time = (d: Date) => formatClock(d.getHours() + d.getMinutes() / 60);

/**
 * On the Week screen while clocked in: asks for notification permission the
 * first time a reminder is needed (with a short explanation), and on the
 * web shows the reminder itself as a banner (CLAUDE.md §3.8).
 */
export function ReminderBanner() {
  const { colors } = useTheme();
  const plan = useReminderPlan();
  const permission = useReminderState((s) => s.permission);
  const setPermission = useReminderState((s) => s.setPermission);
  const dismissedKey = useReminderState((s) => s.dismissedKey);
  const dismiss = useReminderState((s) => s.dismiss);
  const requiredHours = useSettings((s) => s.requiredHours);
  const now = useNow(15_000, plan != null);
  if (!plan) return null;

  const card = [styles.card, { backgroundColor: colors.surfaceSoft, borderColor: colors.border }];
  const web = Platform.OS === 'web';

  if (web && now >= plan.fireAt.getTime() && dismissedKey !== plan.key) {
    return (
      <View
        style={[card, styles.inline]}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert">
        <View style={styles.text}>
          <AppText variant="bodyStrong" tone="good">
            ✓ {plan.title}
          </AppText>
          <AppText>{plan.body}</AppText>
        </View>
        <Button
          variant="quiet"
          label="Dismiss"
          accessibilityLabel="Dismiss the reminder"
          onPress={() => dismiss(plan.key)}
        />
      </View>
    );
  }

  if (permission === 'undetermined') {
    return (
      <View style={card}>
        <AppText variant="bodyStrong">Get a reminder when you can clock out?</AppText>
        <AppText>
          Punch&apos;d can send a notification at your min clock out ({time(plan.minOut)}), when you
          hit your {formatHours(requiredHours).replace(/\.?0+$/, '')} hours
          {web ? ", while Punch'd is open in this browser" : ''}. Nothing is sent anywhere else.
        </AppText>
        <View style={styles.row}>
          <Button
            grow
            label="Not now"
            accessibilityHint="Turns the reminder off. You can turn it on again in Settings."
            onPress={() => useSettings.getState().update({ reminderEnabled: false })}
          />
          <Button
            grow
            variant="primary"
            label="Allow notifications"
            onPress={() => void requestPermission().then(setPermission)}
          />
        </View>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  inline: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, gap: 2 },
});
