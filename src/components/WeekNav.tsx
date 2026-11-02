import { StyleSheet, View } from 'react-native';

import { addDays, formatWeekRange, mondayOf } from '@/timecard/dates';
import { space } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { DateField } from './DateField';

type Props = {
  monday: string;
  today: string;
  onChange: (monday: string) => void;
};

/** Previous / Next around the dates, then pick a date or go back to this week (CLAUDE.md §3.3). */
export function WeekNav({ monday, today, onChange }: Props) {
  const isThisWeek = monday === mondayOf(today);
  const range = formatWeekRange(monday);
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Button
          label="‹"
          accessibilityLabel="Previous week"
          onPress={() => onChange(addDays(monday, -7))}
        />
        <View style={styles.title}>
          <AppText variant="caption" tone={isThisWeek ? 'accent' : 'muted'}>
            {isThisWeek ? 'This week' : 'Week of'}
          </AppText>
          <AppText
            variant="title"
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            accessibilityLabel={isThisWeek ? `This week, ${range}` : `Week of ${range}`}>
            {range}
          </AppText>
        </View>
        <Button
          label="›"
          accessibilityLabel="Next week"
          onPress={() => onChange(addDays(monday, 7))}
        />
      </View>
      <View style={styles.row}>
        <DateField
          value={monday}
          label="Go to the week of a date"
          onChange={(date) => onChange(mondayOf(date))}
        />
        {isThisWeek ? null : (
          <Button
            label="Back to this week"
            variant="quiet"
            onPress={() => onChange(mondayOf(today))}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  // Arrows stay close to the dates on wide screens.
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, maxWidth: 520 },
  title: { flex: 1, alignItems: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
});
