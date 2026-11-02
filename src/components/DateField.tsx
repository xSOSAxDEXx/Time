import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

import { fromKey, toKey } from '@/timecard/dates';

import { Button } from './Button';

export type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
};

/** Jump to a date: opens the phone's calendar (DateField.web.tsx on the web). */
export function DateField({ value, onChange, label }: DateFieldProps) {
  const open = () =>
    DateTimePickerAndroid.open({
      value: fromKey(value),
      mode: 'date',
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(toKey(date));
      },
    });
  return <Button label="Pick date" onPress={open} accessibilityLabel={label} />;
}
