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

/** Previous / This week / Next / pick a date (CLAUDE.md §3.3). */
export function WeekNav({ monday, today, onChange }: Props) {
  const isThisWeek = monday === mondayOf(today);
  return (
    <View style={styles.wrap}>
      <AppText variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
        {isThisWeek ? 'This week' : 'Week of'} · {formatWeekRange(monday)}
      </AppText>
      <View style={styles.row}>
        <Button
          label="‹ Prev"
          accessibilityLabel="Previous week"
          onPress={() => onChange(addDays(monday, -7))}
        />
        <Button label="This week" disabled={isThisWeek} onPress={() => onChange(mondayOf(today))} />
        <Button
          label="Next ›"
          accessibilityLabel="Next week"
          onPress={() => onChange(addDays(monday, 7))}
        />
        <DateField
          value={monday}
          label="Go to the week of a date"
          onChange={(date) => onChange(mondayOf(date))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
});
