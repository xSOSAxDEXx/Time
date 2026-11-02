import { StyleSheet, View } from 'react-native';

import { useSoftConfirm } from '@/hooks/useSoftConfirm';
import { useEntries } from '@/store/entries';
import { clockOutDate } from '@/timecard/clock';
import { clockTimeOf, clockToHours, formatClock } from '@/timecard/dates';
import { space } from '@/theme';

import { Button } from './Button';

const show = (t: string) => formatClock(clockToHours(t) ?? 0);

/**
 * Big "Clock in now" / "Clock out now" for today (CLAUDE.md §3.1). Replacing a
 * time that's already set takes a second tap.
 */
export function ClockButtons({ today }: { today: string }) {
  const entries = useEntries((s) => s.entries);
  const { clockIn, clockOut } = useEntries.getState();
  const { armed, confirm } = useSoftConfirm();

  const started = entries[today]?.start ?? '';
  const outDate = clockOutDate(entries, today);
  const ended = entries[outDate]?.end ?? '';

  const doIn = () => clockIn(today, clockTimeOf(new Date()));
  const doOut = () => clockOut(outDate, clockTimeOf(new Date()));

  const inLabel =
    armed === 'in'
      ? `Replace ${show(started)}?`
      : started
        ? `In at ${show(started)}`
        : 'Clock in now';
  const outLabel =
    armed === 'out'
      ? `Replace ${show(ended)}?`
      : outDate !== today
        ? 'Clock out (overnight)'
        : ended
          ? `Out at ${show(ended)}`
          : 'Clock out now';

  return (
    <View style={styles.row}>
      <Button
        grow
        variant={started ? 'secondary' : 'primary'}
        label={inLabel}
        onPress={() => (started ? confirm('in', doIn) : doIn())}
        accessibilityLabel={
          armed === 'in'
            ? `Tap again to replace your start time, ${show(started)}, with now`
            : inLabel
        }
        accessibilityHint={started ? 'Tap twice to change your start time to now' : undefined}
      />
      <Button
        grow
        variant={started && !ended ? 'primary' : 'secondary'}
        label={outLabel}
        onPress={() => (ended ? confirm('out', doOut) : doOut())}
        accessibilityLabel={
          armed === 'out'
            ? `Tap again to replace your end time, ${show(ended)}, with now`
            : outLabel
        }
        accessibilityHint={ended ? 'Tap twice to change your end time to now' : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
});
