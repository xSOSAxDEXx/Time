import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSettings } from '@/store/settings';
import {
  addBreak,
  breakMinutes,
  formatBreak,
  MAX_BREAKS,
  removeBreak,
  usualBreakTime,
} from '@/timecard/breaks';
import type { Entry } from '@/timecard/types';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { TimeField } from './TimeField';

type Props = {
  entry: Entry;
  onChange: (patch: Pick<Entry, 'breaks' | 'breakHours'>) => void;
};

/**
 * A day's break times (owner request, 4 Nov 2026): when each break was, not
 * just how long. Adding one adds its length to the day's break; the new
 * break starts filled in with the usual break's time (noon unless set).
 */
export function BreaksEditor({ entry, onChange }: Props) {
  const { colors } = useTheme();
  const usualStart = useSettings((s) => s.usualBreakStart);
  const usualMinutes = useSettings((s) => s.usualBreakMinutes);
  const usual = usualBreakTime(usualStart, usualMinutes || 30);
  const [start, setStart] = useState(usual.start);
  const [end, setEnd] = useState(usual.end);
  const breaks = entry.breaks ?? [];
  const length = breakMinutes({ start, end });

  return (
    <View style={styles.wrap}>
      {breaks.length === 0 ? (
        <AppText variant="caption" tone="muted">
          No break times logged. Arrive and leave adds them on Android, or add one here.
        </AppText>
      ) : null}
      {breaks.map((b, i) => (
        <View
          key={`${b.start}-${b.end}-${i}`}
          style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surfaceSoft }]}>
          <View style={styles.grow}>
            <AppText variant="bodyStrong">{formatBreak(b)}</AppText>
            <AppText variant="caption" tone="muted">
              {breakMinutes(b)} min
            </AppText>
          </View>
          <Button
            variant="quiet"
            label="Remove"
            accessibilityLabel={`Remove the break ${formatBreak(b)}`}
            onPress={() => onChange(removeBreak(entry, i))}
          />
        </View>
      ))}
      <View style={styles.add}>
        <View style={styles.time}>
          <AppText variant="caption" tone="muted">
            Break start
          </AppText>
          <TimeField label="Break start" value={start} onChange={setStart} />
        </View>
        <View style={styles.time}>
          <AppText variant="caption" tone="muted">
            Break end
          </AppText>
          <TimeField label="Break end" value={end} onChange={setEnd} />
        </View>
      </View>
      <Button
        label={length ? `Add break (${length} min)` : 'Add break'}
        accessibilityLabel="Add break"
        disabled={!length || breaks.length >= MAX_BREAKS}
        onPress={() => onChange(addBreak(entry, { start, end }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  grow: { flex: 1 },
  add: { flexDirection: 'row', gap: space.sm },
  time: { flex: 1, gap: space.xs },
});
