import { useEntries } from '@/store/entries';
import { useGeo } from '@/store/geo';
import { useSettings } from '@/store/settings';

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
  dismissPromptNotification,
  notifyPrompt,
  scheduleClockOutNotification,
} from './native';

type Persisted = { persist: { hasHydrated: () => boolean; rehydrate: () => Promise<void> | void } };

/** The background task can run before the app has loaded its saved data. */
async function loaded(...stores: Persisted[]) {
  await Promise.all(stores.map((s) => (s.persist.hasHydrated() ? null : s.persist.rehydrate())));
}

/** Notifications are a nice-to-have here: the cards in the app always show. */
const quietly = (p: Promise<unknown>) => p.catch(() => {});

/** Handles one arrive/leave from the phone: works out the question and sends it. */
export async function handleGeoEvent(event: GeoEvent): Promise<void> {
  await loaded(useEntries, useGeo, useSettings);
  if (!useSettings.getState().geofencing) return;
  const geo = useGeo.getState();
  const result = applyEvent(geo, event, useEntries.getState().entries);
  geo.set(result.state);
  if (result.cancelClockOut) await quietly(cancelClockOutNotification());
  if (result.scheduleClockOut) await quietly(scheduleClockOutNotification(result.scheduleClockOut));
  if (result.notify) await quietly(notifyPrompt(result.notify));
}

/** Answers a question (from its card or its notification). Unknown or stale ones do nothing. */
export async function answerGeoPrompt(id: string, answer: GeoAnswer, now = Date.now()) {
  await loaded(useEntries, useGeo);
  const geo = useGeo.getState();
  const { entries, updateDay } = useEntries.getState();
  const prompt = findPrompt(geo, entries, id, now);
  if (!prompt) return;
  const patch = answerPatch(prompt, answer, entries);
  if (patch) updateDay(prompt.date, patch);
  geo.set(afterAnswer(geo, prompt));
  await quietly(dismissPromptNotification(prompt));
}
