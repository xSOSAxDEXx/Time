import { StyleSheet, View } from 'react-native';

import { visiblePrompts } from '@/geofence/engine';
import { answerGeoPrompt } from '@/geofence/handle';
import { promptText } from '@/geofence/text';
import { useNow } from '@/hooks/useNow';
import { useEntries } from '@/store/entries';
import { useGeo } from '@/store/geo';
import { radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

/**
 * Arrive-and-leave questions waiting for an answer (CLAUDE.md §3.11), on the
 * Week screen. The same questions come as notifications; answering either
 * one clears both.
 */
export function GeoPrompts() {
  const { colors } = useTheme();
  const pendingExit = useGeo((s) => s.pendingExit);
  const prompts = useGeo((s) => s.prompts);
  const entries = useEntries((s) => s.entries);
  const now = useNow(30_000, !!pendingExit || prompts.length > 0);
  const list = visiblePrompts({ inside: {}, pendingExit, prompts }, entries, now);
  if (!list.length) return null;
  return (
    <View style={styles.list}>
      {list.map((p) => {
        const t = promptText(p);
        return (
          <View
            key={p.id}
            accessibilityLiveRegion="polite"
            style={[
              styles.card,
              { backgroundColor: colors.surfaceSoft, borderColor: colors.border },
            ]}>
            <AppText variant="bodyStrong">{t.title}</AppText>
            <AppText>{t.body}</AppText>
            <View style={styles.row}>
              {t.actions.map((a, i) => (
                <Button
                  key={a.answer}
                  grow
                  variant={i === 0 ? 'primary' : 'secondary'}
                  label={a.label}
                  onPress={() => void answerGeoPrompt(p.id, a.answer, now)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  card: { gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
