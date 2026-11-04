import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { DEFAULT_RADIUS, RADIUS_CHOICES, type GeoPlace } from '@/geofence/engine';
import {
  currentPosition,
  geofencingSupported,
  getLocationAccess,
  requestLocationAccess,
  type LocationAccess,
} from '@/geofence/native';
import { circleForOutline, distanceMeters, insideOutline, type LatLng } from '@/geofence/outline';
import { openAppSettings, requestPermission } from '@/notifications/scheduler';
import { useReminderState } from '@/notifications/useReminder';
import { useGeo } from '@/store/geo';
import { useSettings } from '@/store/settings';
import { clockTimeOf, clockToHours, formatClock } from '@/timecard/dates';
import { radius as radii, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { ChoiceChips } from './ChoiceChips';
import { AddItem } from './ListEditor';
import { PlaceOutline } from './PlaceOutline';
import { PlacesShare } from './PlacesShare';
import { Section } from './Section';
import { SwitchRow } from './SwitchRow';

const radiusLabel = (m: number) => `${m} m`;

/** Arrive-and-leave settings (CLAUDE.md §3.11): on/off and a circle for each location. */
export function GeoSection() {
  const { colors } = useTheme();
  const enabled = useSettings((s) => s.geofencing);
  const places = useSettings((s) => s.places);
  const locations = useSettings((s) => s.locations);
  const update = useSettings((s) => s.update);
  const setNotifyPermission = useReminderState((s) => s.setPermission);
  const [access, setAccess] = useState<LocationAccess | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Outline editors opened or closed by hand (otherwise open when there's an outline).
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [whereAmI, setWhereAmI] = useState<string[] | null>(null);
  const inside = useGeo((s) => s.inside);

  useEffect(() => {
    if (!geofencingSupported()) return;
    const check = () => void getLocationAccess().then(setAccess, () => {});
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, []);

  if (!geofencingSupported()) {
    return (
      <Section title="Arrive and leave">
        <AppText variant="caption" tone="muted">
          In the Android app, Punch&apos;d can ask to clock you in and out when you arrive at and
          leave your places. Browsers can&apos;t watch your location with the page closed, so it
          isn&apos;t available on the web.
        </AppText>
      </Section>
    );
  }

  const turnOn = async (on: boolean) => {
    setError(null);
    if (!on) return update({ geofencing: false });
    const got = await requestLocationAccess();
    setAccess(got);
    if (got === 'denied' || got === 'undetermined') {
      setError("Punch'd needs location access to know when you arrive and leave.");
      return;
    }
    setNotifyPermission(await requestPermission());
    update({ geofencing: true });
  };

  /** Where the phone is, asking for access first if needed. Null (with a message) if not. */
  const findMe = async (): Promise<LatLng | null> => {
    setError(null);
    try {
      let got = access;
      if (got !== 'always' && got !== 'whileUsing') got = await requestLocationAccess();
      setAccess(got);
      if (got !== 'always' && got !== 'whileUsing') {
        setError("Punch'd needs location access to find where you are.");
        return null;
      }
      return await currentPosition();
    } catch {
      setError("Couldn't find where you are. Check that location is on, then try again.");
      return null;
    }
  };

  const setHere = async (location: string) => {
    setBusy(location);
    const pos = await findMe();
    setBusy(null);
    if (!pos) return;
    const old = places.find((p) => p.location === location);
    const place: GeoPlace = {
      location,
      ...pos,
      // A circle replaces an outline; keep the size chosen before.
      radiusMeters: old && !old.outline ? old.radiusMeters : DEFAULT_RADIUS,
    };
    update({ places: [...places.filter((p) => p.location !== location), place] });
  };

  const setOutline = (location: string, outline: LatLng[] | null) => {
    const rest = useSettings.getState().places.filter((p) => p.location !== location);
    update({
      places: outline ? [...rest, { location, ...circleForOutline(outline), outline }] : rest,
    });
  };

  const checkWhere = async () => {
    setBusy('where');
    const pos = await findMe();
    setBusy(null);
    if (!pos) return;
    const set = places.filter((p) => locations.includes(p.location));
    if (!set.length) return setWhereAmI(['No places set yet.']);
    setWhereAmI(
      set.map((p) => {
        const m = Math.round(distanceMeters(pos, p));
        const inCircle = m <= p.radiusMeters;
        const where =
          p.outline && p.outline.length >= 3
            ? insideOutline(pos, p.outline)
              ? 'inside the outline'
              : inCircle
                ? 'outside the outline but inside its circle'
                : `${m - p.radiusMeters} m outside its circle`
            : inCircle
              ? `inside the circle (${m} m from the middle)`
              : `${m - p.radiusMeters} m outside the circle`;
        const seen = inside[p.location];
        const phone = seen
          ? ` Android last said you arrived at ${formatClock(clockToHours(clockTimeOf(new Date(seen))) ?? 0)}.`
          : '';
        return `${p.location}: ${where}.${phone}`;
      }),
    );
  };

  const setRadius = (location: string, radiusMeters: number) =>
    update({ places: places.map((p) => (p.location === location ? { ...p, radiusMeters } : p)) });
  /** Takes a place off the Locations list, and its circle with it. */
  const deletePlace = (location: string) => {
    update({
      locations: locations.filter((l) => l !== location),
      places: places.filter((p) => p.location !== location),
    });
    setDeleting(null);
  };
  const remove = (location: string) =>
    update({ places: places.filter((p) => p.location !== location) });

  return (
    <Section title="Arrive and leave">
      <AppText variant="caption" tone="muted">
        When you arrive at or leave one of your places, Punch&apos;d asks: clock in, clock out, was
        that a break, or count the drive as time worked. Nothing is logged unless you say yes. Your
        location stays on this phone; only the places you set here are saved.
      </AppText>
      <SwitchRow
        label="Ask when I arrive and leave"
        description="Needs location access “all the time” and notifications."
        value={enabled}
        onChange={(on) => void turnOn(on)}
      />
      {enabled && access === 'whileUsing' ? (
        <View style={styles.block}>
          <AppText tone="warn">
            ⚠ Choose “Allow all the time” for Punch&apos;d&apos;s location access, or Android
            won&apos;t tell Punch&apos;d when you arrive or leave with the app closed.
          </AppText>
          <Button label="Open phone settings" onPress={openAppSettings} />
        </View>
      ) : null}
      {error ? <AppText tone="bad">{error}</AppText> : null}

      {enabled ? (
        <View style={styles.block}>
          <AppText variant="label" tone="muted">
            Your places
          </AppText>
          <AppText variant="caption" tone="muted">
            Stand at each place and tap “Set to where I am now”. For a big site, tap “Outline” and
            add its corners from Google Maps instead. Add a new place at the bottom; it&apos;s added
            to your Locations list too.
          </AppText>
          {locations.map((location) => {
            const place = places.find((p) => p.location === location);
            const outlineOpen = open[location] ?? !!place?.outline;
            return (
              <View
                key={location}
                style={[
                  styles.place,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}>
                <AppText variant="bodyStrong">{location}</AppText>
                <AppText variant="caption" tone={place ? 'good' : 'muted'}>
                  {!place
                    ? 'Not set'
                    : place.outline
                      ? `✓ Outline · ${place.outline.length} corners · ${radiusLabel(place.radiusMeters)} circle`
                      : `✓ Set · ${radiusLabel(place.radiusMeters)} circle`}
                </AppText>
                <View style={styles.row}>
                  <Button
                    grow
                    label={
                      busy === location
                        ? 'Finding you…'
                        : place && !place.outline
                          ? 'Move to where I am now'
                          : 'Set to where I am now'
                    }
                    disabled={busy != null}
                    accessibilityLabel={`Set ${location} to where I am now`}
                    onPress={() => void setHere(location)}
                  />
                  <Button
                    variant="quiet"
                    label={outlineOpen ? 'Hide outline' : 'Outline'}
                    accessibilityLabel={
                      outlineOpen
                        ? `Hide ${location}'s outline`
                        : `Draw ${location}'s outline from map points`
                    }
                    onPress={() => setOpen({ ...open, [location]: !outlineOpen })}
                  />
                  {place ? (
                    <Button
                      variant="quiet"
                      label="Clear"
                      accessibilityLabel={`Clear ${location}'s circle`}
                      onPress={() => remove(location)}
                    />
                  ) : null}
                  <Button
                    variant="quiet"
                    label="Delete place"
                    accessibilityLabel={`Delete ${location}`}
                    onPress={() => setDeleting(location)}
                  />
                </View>
                {deleting === location ? (
                  <View style={styles.block}>
                    <AppText>
                      Delete {location} from your places and Locations list? Days already logged
                      keep it.
                    </AppText>
                    <View style={styles.row}>
                      <Button
                        label="Delete"
                        accessibilityLabel={`Yes, delete ${location}`}
                        onPress={() => deletePlace(location)}
                      />
                      <Button variant="quiet" label="Keep" onPress={() => setDeleting(null)} />
                    </View>
                  </View>
                ) : null}
                {outlineOpen ? (
                  <PlaceOutline
                    location={location}
                    outline={place?.outline ?? []}
                    onChange={(o) => setOutline(location, o)}
                    here={findMe}
                  />
                ) : null}
                {place && !place.outline ? (
                  <ChoiceChips
                    label={`${location} circle size`}
                    clearable={false}
                    options={RADIUS_CHOICES.map(radiusLabel)}
                    value={radiusLabel(place.radiusMeters)}
                    onChange={(l) => setRadius(location, parseInt(l, 10))}
                  />
                ) : null}
              </View>
            );
          })}
          <AddItem
            itemName="place"
            items={locations}
            onChange={(next) => update({ locations: next })}
          />
          <Button
            label={busy === 'where' ? 'Finding you…' : 'Check where I am'}
            disabled={busy != null}
            onPress={() => void checkWhere()}
          />
          {whereAmI ? (
            <View accessibilityLiveRegion="polite" style={styles.block}>
              {whereAmI.map((line) => (
                <AppText key={line} variant="caption">
                  {line}
                </AppText>
              ))}
            </View>
          ) : null}
          <AppText variant="caption" tone="muted">
            Android can take a few minutes to notice you arriving or leaving, and circles smaller
            than 150 m can be missed. Absences of 5 minutes or less are ignored. If questions
            don&apos;t come, turn off battery optimization for Punch&apos;d in your phone&apos;s
            settings.
          </AppText>
        </View>
      ) : null}
      <PlacesShare />
    </Section>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  place: { gap: space.xs, padding: space.md, borderRadius: radii.md, borderWidth: 1 },
});
