import { useEntries } from '@/store/entries';
import { useGeo } from '@/store/geo';
import { useSettings } from '@/store/settings';
import { minutesToHours } from '@/timecard/dates';

import {
  afterAnswer,
  answerPatch,
  applyEvent,
  findPrompt,
  type GeoAnswer,
  type GeoEvent,
} from './engine';
import {
  cancelClockOutNotification,
  cancelPromptNotification,
  CLOCK_OUT_NOTIFICATION,
  dismissPromptNotification,
  notifyPrompt,
  scheduleClockOutNotification,
} from './native';

type Persisted = {
  persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void };
};

/**
 * The background task, or an answer tapped as the app starts, can run before
 * the saved data has loaded. Waits for that load to finish (rather than
 * starting a second one, which could land after our change and undo it).
 */
async function loaded(...stores: Persisted[]) {
  await Promise.all(
    stores.map((s) =>
      s.persist.hasHydrated()
        ? null
        : new Promise<void>((resolve) => {
            const stop = s.persist.onFinishHydration(() => {
              stop();
              resolve();
            });
          }),
    ),
  );
}

/** Notifications are a nice-to-have here: the cards in the app always show. */
const quietly = (p: Promise<unknown>) => p.catch(() => {});

/** Handles one arrive/leave from the phone: works out the question and sends it. */
export async function handleGeoEvent(event: GeoEvent): Promise<void> {
  await loaded(useEntries, useGeo, useSettings);
  if (!useSettings.getState().geofencing) return;
  const geo = useGeo.getState();
  const usualBreak = minutesToHours(useSettings.getState().usualBreakMinutes);
  const result = applyEvent(geo, event, useEntries.getState().entries, usualBreak);
  geo.set(result.state);
  if (result.cancelClockOut) await quietly(cancelClockOutNotification());
  if (result.cancelPromptId) await quietly(cancelPromptNotification(result.cancelPromptId));
  if (result.scheduleClockOut) await quietly(scheduleClockOutNotification(result.scheduleClockOut));
  if (result.notify) await quietly(notifyPrompt(result.notify, result.notifyAt));
}

/** Answers a question (from its card or its notification). Unknown or stale ones do nothing. */
export async function answerGeoPrompt(id: string, answer: GeoAnswer, now = Date.now()) {
  await loaded(useEntries, useGeo, useSettings);
  const geo = useGeo.getState();
  const { entries, updateDay } = useEntries.getState();
  const prompt = findPrompt(geo, entries, id, now);
  if (!prompt) {
    // Already answered or out of date: just clear its notification.
    await quietly(
      cancelPromptNotification(id.startsWith('clockOut-') ? CLOCK_OUT_NOTIFICATION : id),
    );
    return;
  }
  const patch = answerPatch(prompt, answer, entries, useSettings.getState().usualBreakStart);
  if (patch) updateDay(prompt.date, patch);
  geo.set(afterAnswer(geo, prompt, answer));
  await quietly(dismissPromptNotification(prompt));
  // Back from the trip: its "Clock out?" (if still showing) is settled too.
  if (prompt.kind === 'break' || prompt.kind === 'travel')
    await quietly(cancelClockOutNotification());
}
