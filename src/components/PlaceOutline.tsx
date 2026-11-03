import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle, Polygon, Text as SvgText } from 'react-native-svg';

import {
  circleForOutline,
  MAX_CORNERS,
  MAX_OUTLINE_RADIUS_M,
  outlineShape,
  parseCorners,
  type LatLng,
} from '@/geofence/outline';
import { radius, space, type, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

type Props = {
  location: string;
  outline: LatLng[];
  /** Saves the corners (null removes the outline). */
  onChange: (outline: LatLng[] | null) => void;
  /** Where the phone is now, for "Add a corner where I am". */
  here: () => Promise<LatLng | null>;
};

/**
 * A big place's outline (owner request, 3 Nov 2026): corners pasted from
 * Google Maps or added while walking round. Android watches the smallest
 * circle that covers them, drawn here so a wrong corner is easy to spot.
 */
export function PlaceOutline({ location, outline, onChange, here }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);

  const save = (corners: LatLng[]) => {
    if (corners.length > MAX_CORNERS) {
      setNote(`That's more than ${MAX_CORNERS} corners. Use just the main corners.`);
      return false;
    }
    if (circleForOutline(corners).radiusMeters > MAX_OUTLINE_RADIUS_M) {
      setNote('Those corners are more than 10 km apart. Check for a mistyped one.');
      return false;
    }
    onChange(corners);
    return true;
  };

  const addPasted = () => {
    const found = parseCorners(text);
    if (!found.length) {
      setNote('No map points found. Paste them like 40.71234, -74.00123.');
      return;
    }
    if (save([...outline, ...found])) {
      setText('');
      setNote(`Added ${found.length} corner${found.length === 1 ? '' : 's'}.`);
    }
  };

  const addHere = async () => {
    setFinding(true);
    setNote(null);
    const p = await here();
    setFinding(false);
    if (p && save([...outline, p])) setNote('Added a corner where you are.');
  };

  const circle = outline.length ? circleForOutline(outline) : null;
  const shape = circle ? outlineShape(outline, circle) : null;

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" tone="muted">
        For a big site. In Google Maps, press and hold on each corner of the site to drop a pin, tap
        the numbers at the top (like 40.71234, -74.00123) to copy them, and paste them here. Go
        round the edge in order. You can paste several at once, or walk to each corner and add it.
      </AppText>

      {circle && shape ? (
        <View style={[styles.preview, { borderColor: colors.border }]}>
          <Svg
            width="100%"
            height={160}
            viewBox={`${-shape.size * 0.05} ${-shape.size * 0.05} ${shape.size * 1.1} ${shape.size * 1.1}`}
            accessibilityLabel={`${location}'s outline: ${outline.length} corners inside a ${circle.radiusMeters} m circle`}>
            <Circle
              cx={shape.size / 2}
              cy={shape.size / 2}
              r={shape.size / 2}
              fill="none"
              stroke={colors.textMuted}
              strokeWidth={shape.size / 150}
              strokeDasharray={`${shape.size / 40} ${shape.size / 60}`}
            />
            {shape.points.length >= 3 ? (
              <Polygon
                points={shape.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill={colors.accent}
                fillOpacity={0.18}
                stroke={colors.accent}
                strokeWidth={shape.size / 100}
              />
            ) : null}
            {shape.points.map((p, i) => (
              <SvgText
                key={i}
                x={p.x}
                y={p.y}
                fill={colors.text}
                fontSize={shape.size / 14}
                fontWeight="bold"
                textAnchor="middle"
                alignmentBaseline="middle">
                {i + 1}
              </SvgText>
            ))}
          </Svg>
        </View>
      ) : null}

      <AppText variant="caption" tone={outline.length >= 3 ? 'good' : 'muted'}>
        {outline.length === 0
          ? 'No corners yet.'
          : outline.length < 3
            ? `${outline.length} corner${outline.length === 1 ? '' : 's'}. Add at least 3.`
            : `✓ ${outline.length} corners. Clocked watches the ${circle?.radiusMeters} m circle around them (dashed).`}
      </AppText>

      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        accessibilityLabel={`Paste corners for ${location}`}
        placeholder="Paste corners, e.g. 40.71234, -74.00123"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          type.body,
          styles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />
      <View style={styles.row}>
        <Button
          grow
          label="Add pasted corners"
          disabled={!text.trim()}
          accessibilityLabel={`Add pasted corners to ${location}`}
          onPress={addPasted}
        />
        <Button
          grow
          label={finding ? 'Finding you…' : 'Add a corner where I am'}
          disabled={finding}
          accessibilityLabel={`Add a corner to ${location} where I am now`}
          onPress={() => void addHere()}
        />
      </View>
      {outline.length ? (
        <View style={styles.row}>
          <Button
            variant="quiet"
            label="Undo last corner"
            accessibilityLabel={`Remove ${location}'s last corner`}
            onPress={() => onChange(outline.length > 1 ? outline.slice(0, -1) : null)}
          />
          <Button
            variant="quiet"
            label="Clear outline"
            accessibilityLabel={`Clear ${location}'s outline`}
            onPress={() => {
              onChange(null);
              setNote(null);
            }}
          />
        </View>
      ) : null}
      {note ? (
        <AppText variant="caption" tone="muted" accessibilityLiveRegion="polite">
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  preview: { borderWidth: 1, borderRadius: radius.md, padding: space.xs },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    textAlignVertical: 'top',
  },
});
