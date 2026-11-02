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
import { openAppSettings, requestPermission } from '@/notifications/scheduler';
import { useReminderState } from '@/notifications/useReminder';
import { useSettings } from '@/store/settings';
import { radius as radii, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { ChoiceChips } from './ChoiceChips';
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
          In the Android app, Clocked can ask to clock you in and out when you arrive at and leave
          your places. Browsers can&apos;t watch your location with the page closed, so it
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
      setError('Clocked needs location access to know when you arrive and leave.');
      return;
    }
    setNotifyPermission(await requestPermission());
    update({ geofencing: true });
  };

  const setHere = async (location: string) => {
    setError(null);
    setBusy(location);
    try {
      let got = access;
      if (got !== 'always' && got !== 'whileUsing') got = await requestLocationAccess();
      setAccess(got);
      if (got !== 'always' && got !== 'whileUsing') {
        setError('Clocked needs location access to find where you are.');
        return;
      }
      const pos = await currentPosition();
      const old = places.find((p) => p.location === location);
      const place: GeoPlace = {
        location,
        ...pos,
        radiusMeters: old?.radiusMeters ?? DEFAULT_RADIUS,
      };
      update({ places: [...places.filter((p) => p.location !== location), place] });
    } catch {
      setError("Couldn't find where you are. Check that location is on, then try again.");
    } finally {
      setBusy(null);
    }
  };

  const setRadius = (location: string, radiusMeters: number) =>
    update({ places: places.map((p) => (p.location === location ? { ...p, radiusMeters } : p)) });
  const remove = (location: string) =>
    update({ places: places.filter((p) => p.location !== location) });

  return (
    <Section title="Arrive and leave">
      <AppText variant="caption" tone="muted">
        When you arrive at or leave one of your places, Clocked asks: clock in, clock out, was that
        a break, or count the drive as time worked. Nothing is logged unless you say yes. Your
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
            ⚠ Choose “Allow all the time” for Clocked&apos;s location access, or Android won&apos;t
            tell Clocked when you arrive or leave with the app closed.
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
            Stand at each place and tap “Set to where I am now”. Places come from Settings → Lists →
            Locations.
          </AppText>
          {locations.map((location) => {
            const place = places.find((p) => p.location === location);
            return (
              <View
                key={location}
                style={[
                  styles.place,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}>
                <AppText variant="bodyStrong">{location}</AppText>
                <AppText variant="caption" tone={place ? 'good' : 'muted'}>
                  {place ? `✓ Set · ${radiusLabel(place.radiusMeters)} circle` : 'Not set'}
                </AppText>
                <View style={styles.row}>
                  <Button
                    grow
                    label={
                      busy === location
                        ? 'Finding you…'
                        : place
                          ? 'Move to where I am now'
                          : 'Set to where I am now'
                    }
                    disabled={busy != null}
                    accessibilityLabel={`Set ${location} to where I am now`}
                    onPress={() => void setHere(location)}
                  />
                  {place ? (
                    <Button
                      variant="quiet"
                      label="Remove"
                      accessibilityLabel={`Remove ${location}'s circle`}
                      onPress={() => remove(location)}
                    />
                  ) : null}
                </View>
                {place ? (
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
          <AppText variant="caption" tone="muted">
            Android can take a few minutes to notice you arriving or leaving, and circles smaller
            than 150 m can be missed. Absences of 5 minutes or less are ignored. If questions
            don&apos;t come, turn off battery optimization for Clocked in your phone&apos;s
            settings.
          </AppText>
        </View>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  place: { gap: space.xs, padding: space.md, borderRadius: radii.md, borderWidth: 1 },
});
