import { Platform } from 'react-native';

import { openAppSettings, requestPermission } from '@/notifications/scheduler';
import { useReminderState } from '@/notifications/useReminder';
import { useSettings, type ReminderLead } from '@/store/settings';

import { AppText } from './AppText';
import { Button } from './Button';
import { ChoiceChips } from './ChoiceChips';
import { Labeled, Section } from './Section';
import { SwitchRow } from './SwitchRow';

const LEADS: [ReminderLead, string][] = [
  [0, 'At min clock out'],
  [5, '5 min early'],
  [10, '10 min early'],
  [15, '15 min early'],
];

/** Clock-out reminder settings (CLAUDE.md §3.8), with the plain truth about the web. */
export function ReminderSection() {
  const enabled = useSettings((s) => s.reminderEnabled);
  const lead = useSettings((s) => s.reminderLeadMinutes);
  const update = useSettings((s) => s.update);
  const permission = useReminderState((s) => s.permission);
  const setPermission = useReminderState((s) => s.setPermission);
  const web = Platform.OS === 'web';

  return (
    <Section title="Clock-out reminder">
      <SwitchRow
        label="Remind me when I can clock out"
        description="A notification at your min clock-out time, set when you clock in."
        value={enabled}
        onChange={(reminderEnabled) => update({ reminderEnabled })}
      />
      {enabled ? (
        <>
          <Labeled label="When">
            <ChoiceChips
              label="When to remind"
              clearable={false}
              options={LEADS.map(([, l]) => l)}
              value={LEADS.find(([m]) => m === lead)?.[1] ?? LEADS[0][1]}
              onChange={(l) =>
                update({ reminderLeadMinutes: LEADS.find(([, x]) => x === l)?.[0] ?? 0 })
              }
            />
          </Labeled>
          {permission === 'undetermined' ? (
            <>
              <AppText variant="caption" tone="muted">
                Clocked needs your permission to show notifications.
              </AppText>
              <Button
                label="Allow notifications"
                onPress={() => void requestPermission().then(setPermission)}
              />
            </>
          ) : permission === 'denied' ? (
            <>
              <AppText tone="warn">
                ⚠ Notifications are turned off for Clocked
                {web ? " in this browser's site settings." : " in your phone's settings."}
                {web ? ' The reminder still shows as a banner while Clocked is open.' : ''}
              </AppText>
              {web ? null : <Button label="Open phone settings" onPress={openAppSettings} />}
            </>
          ) : permission === 'unsupported' ? (
            <AppText variant="caption" tone="muted">
              This browser can&apos;t show notifications, so the reminder shows as a banner while
              Clocked is open.
            </AppText>
          ) : null}
        </>
      ) : null}
      {web ? (
        <AppText variant="caption" tone="muted">
          On the web, the reminder only works while Clocked is open in a browser tab: browsers
          can&apos;t notify you once the page is closed. On iPhone, add Clocked to your Home Screen
          first. For reminders with the app closed, use the Android app.
        </AppText>
      ) : null}
    </Section>
  );
}
