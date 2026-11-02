import { AppText } from '@/components/AppText';
import { ComingSoon } from '@/components/ComingSoon';
import { Screen } from '@/components/Screen';

export default function SummaryScreen() {
  return (
    <Screen>
      <AppText variant="display" accessibilityRole="header">
        Summary
      </AppText>
      <ComingSoon title="Your averages and all weeks" step={4}>
        Average hours per week and per day this year, this week against your target, and every week
        you&apos;ve logged.
      </ComingSoon>
    </Screen>
  );
}
