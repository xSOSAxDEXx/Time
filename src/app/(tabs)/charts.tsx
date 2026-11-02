import { AppText } from '@/components/AppText';
import { ComingSoon } from '@/components/ComingSoon';
import { Screen } from '@/components/Screen';

export default function ChartsScreen() {
  return (
    <Screen>
      <AppText variant="display" accessibilityRole="header">
        Charts
      </AppText>
      <ComingSoon title="Hours per day and per week" step={5}>
        See your hours for this week, last month or any dates you pick.
      </ComingSoon>
    </Screen>
  );
}
