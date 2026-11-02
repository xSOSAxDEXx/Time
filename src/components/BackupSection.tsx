import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import {
  applyRestore,
  chooseRestoreFile,
  describeBackup,
  exportBackup,
  exportCsv,
  type Outcome,
} from '@/backup/backup';
import type { ParsedBackup } from '@/backup/format';
import { useEntries } from '@/store/entries';
import { loggedDates } from '@/timecard/calc';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Section } from './Section';

/**
 * Backup, restore and the spreadsheet export (CLAUDE.md §3.7). Restoring
 * shows what the file holds and asks before replacing anything.
 */
export function BackupSection() {
  const { colors } = useTheme();
  const daysHere = useEntries((s) => loggedDates(s.entries).length);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);

  const run = async (task: () => Promise<Outcome | null>) => {
    setBusy(true);
    setOutcome(null);
    try {
      const result = await task();
      if (result) setOutcome(result);
    } catch {
      setOutcome({ ok: false, message: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const restore = () =>
    run(async () => {
      setPending(null);
      const choice = await chooseRestoreFile();
      if (!choice) return null;
      if ('backup' in choice) {
        setPending(choice.backup);
        return null;
      }
      return choice;
    });

  return (
    <Section title="Backup and export">
      <AppText variant="caption" tone="muted">
        {Platform.OS === 'web'
          ? 'Back up to a file you keep (it downloads), and restore it on any device.'
          : 'Back up to a file you keep (Files, Drive, email...), and restore it on any device.'}{' '}
        Restore also reads the time card page&apos;s data file (timecard-data.json) and its Backup
        file.
      </AppText>
      <View style={styles.row}>
        <Button
          grow
          variant="primary"
          label="Back up"
          disabled={busy}
          accessibilityHint="Saves all your days and settings to one file"
          onPress={() => run(() => exportBackup())}
        />
        <Button
          grow
          label="Restore"
          disabled={busy}
          accessibilityHint="Choose a backup file. You'll be asked before anything is replaced."
          onPress={restore}
        />
      </View>
      <Button
        label="Export spreadsheet (CSV)"
        disabled={busy}
        accessibilityHint="Makes a file that opens in Excel"
        onPress={() => run(() => exportCsv())}
      />

      {pending ? (
        <View
          style={[
            styles.confirm,
            { backgroundColor: colors.surfaceSoft, borderColor: colors.border },
          ]}
          accessibilityLiveRegion="polite">
          <AppText variant="bodyStrong">Replace what&apos;s on this device?</AppText>
          <AppText>{describeBackup(pending)}</AppText>
          <AppText tone="muted">
            {daysHere
              ? `The ${daysHere} ${daysHere === 1 ? 'day' : 'days'} on this device will be replaced`
              : 'This device has no days logged yet, so nothing is lost'}
            {pending.source === 'clocked'
              ? daysHere
                ? ', and so will your settings.'
                : '. Your settings will be replaced.'
              : daysHere
                ? '. Your name, hours and lists come from the file; holidays and pay stay as they are.'
                : '. Your name, hours and lists come from the file.'}
          </AppText>
          <View style={styles.row}>
            <Button grow label="Cancel" onPress={() => setPending(null)} />
            <Button
              grow
              variant="primary"
              label="Replace"
              accessibilityLabel="Replace with this file"
              onPress={() => {
                setOutcome(applyRestore(pending));
                setPending(null);
              }}
            />
          </View>
        </View>
      ) : null}

      {outcome ? (
        <AppText tone={outcome.ok ? 'good' : 'bad'} accessibilityLiveRegion="polite">
          {outcome.ok ? '✓ ' : ''}
          {outcome.message}
        </AppText>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  confirm: { gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
});
