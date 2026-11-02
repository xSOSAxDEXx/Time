import { AppText } from '@/components/AppText';
import { ComingSoon } from '@/components/ComingSoon';
import { Screen } from '@/components/Screen';

export default function SettingsScreen() {
  return (
    <Screen>
      <AppText variant="display" accessibilityRole="header">
        Settings
      </AppText>
      <ComingSoon title="Your details and preferences" step={4}>
        Required hours per day, locations, time off types, theme, backup and restore, the clock-out
        reminder and pay.
      </ComingSoon>
    </Screen>
  );
}
