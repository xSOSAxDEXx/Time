import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  applyPlaces,
  choosePlacesFile,
  listNames,
  sharePlaces,
  type Outcome,
} from '@/backup/backup';
import type { ImportPlan } from '@/backup/places';
import type { GeoPlace } from '@/geofence/engine';
import { useSettings } from '@/store/settings';
import { space } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

type Pending = { places: GeoPlace[]; plan: ImportPlan };

/** What the file would do, in plain words. */
function describePlan({ places, plan }: Pending): string {
  const n = places.length;
  return [
    `This file has ${n} ${n === 1 ? 'place' : 'places'}.`,
    plan.fresh.length ? `New to this phone: ${listNames(plan.fresh)}.` : '',
    plan.same.length ? `Already set the same: ${listNames(plan.same)}.` : '',
    plan.differ.length ? `Set differently on this phone: ${listNames(plan.differ)}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Share places with coworkers, or add theirs (owner request, 4 Nov 2026). */
export function PlacesShare() {
  const enabled = useSettings((s) => s.geofencing);
  const [pending, setPending] = useState<Pending | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    setPending(null);
    setOutcome(await sharePlaces());
    setBusy(false);
  };

  const choose = async () => {
    setBusy(true);
    setOutcome(null);
    const got = await choosePlacesFile();
    setBusy(false);
    if (!got) return;
    if (!got.ok) return setOutcome(got);
    const { plan, places } = got as Pending & { ok: true };
    if (!plan.fresh.length && !plan.differ.length) {
      return setOutcome({ ok: true, message: 'You already have all of these places.' });
    }
    setPending({ places, plan });
  };

  const add = (replaceMine: boolean) => {
    if (!pending) return;
    const done = applyPlaces(pending.places, replaceMine);
    setPending(null);
    setOutcome(
      enabled
        ? done
        : {
            ...done,
            message: `${done.message} Turn on “Ask when I arrive and leave” to use them.`,
          },
    );
  };

  return (
    <View style={styles.block}>
      <AppText variant="label" tone="muted">
        Share with coworkers
      </AppText>
      <AppText variant="caption" tone="muted">
        “Share places” makes a file with just your places and their outlines (no hours, pay or other
        settings). “Import places” adds the places from a coworker&apos;s file; your logged days
        stay as they are.
      </AppText>
      <View style={styles.row}>
        <Button
          grow
          variant="quiet"
          label="Share places"
          disabled={busy}
          onPress={() => void share()}
        />
        <Button
          grow
          variant="quiet"
          label="Import places"
          disabled={busy}
          onPress={() => void choose()}
        />
      </View>
      {pending ? (
        <View style={styles.block}>
          <AppText>{describePlan(pending)}</AppText>
          <View style={styles.row}>
            {pending.plan.differ.length ? (
              <>
                <Button
                  label="Add new, keep mine"
                  accessibilityLabel="Add the new places and keep my own versions"
                  onPress={() => add(false)}
                />
                <Button
                  variant="quiet"
                  label="Add and replace mine"
                  accessibilityLabel="Add the places and replace my own versions"
                  onPress={() => add(true)}
                />
              </>
            ) : (
              <Button label="Add places" onPress={() => add(false)} />
            )}
            <Button variant="quiet" label="Cancel" onPress={() => setPending(null)} />
          </View>
        </View>
      ) : null}
      {outcome ? (
        <AppText accessibilityLiveRegion="polite" tone={outcome.ok ? 'good' : 'bad'}>
          {outcome.message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
