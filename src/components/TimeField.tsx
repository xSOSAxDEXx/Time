import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet } from 'react-native';

import { clockTimeOf, clockToHours, formatClock } from '@/timecard/dates';
import { MIN_TAP, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

export type TimeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Screen-reader name, e.g. "Start shift". */
  label: string;
  compact?: boolean;
};

/** A time of day. Tapping opens the phone's clock picker (TimeField.web.tsx on the web). */
export function TimeField({ value, onChange, label, compact }: TimeFieldProps) {
  const { colors } = useTheme();
  const hours = clockToHours(value);
  const open = () => {
    const initial = new Date();
    if (hours != null) initial.setHours(Math.floor(hours), Math.round((hours % 1) * 60), 0, 0);
    DateTimePickerAndroid.open({
      value: initial,
      mode: 'time',
      is24Hour: false,
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(clockTimeOf(date));
      },
    });
  };
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${hours != null ? formatClock(hours) : 'not set'}`}
      accessibilityHint="Opens a clock to pick the time"
      style={({ pressed }) => [
        styles.field,
        compact && styles.compact,
        { borderColor: colors.border, backgroundColor: colors.surface },
        pressed && styles.pressed,
      ]}>
      <AppText variant="number" tone={hours != null ? 'primary' : 'muted'}>
        {hours != null ? formatClock(hours) : '--:--'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: MIN_TAP,
    minWidth: 110,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: 40, minWidth: 100, paddingHorizontal: space.sm },
  pressed: { opacity: 0.7 },
});
