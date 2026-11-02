import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ComingSoon } from '@/components/ComingSoon';
import { Screen } from '@/components/Screen';
import { space } from '@/theme';

const logo = require('@/assets/brand/logo-mark.png');

export default function WeekScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Image source={logo} style={styles.logo} accessibilityIgnoresInvertColors alt="" />
        <View style={styles.headerText}>
          <AppText variant="display" accessibilityRole="header">
            Clocked
          </AppText>
          <AppText tone="muted">Clock in, clock out, know where you stand.</AppText>
        </View>
      </View>
      <ComingSoon title="Your week" step={3}>
        Clock in and out, log breaks, remote work and time off, and see your hours and minimum
        clock-out time for each day.
      </ComingSoon>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1, gap: space.xs },
  logo: { width: 72, height: 72 },
});
