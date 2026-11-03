import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { MIN_TAP, radius, space, type, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

type Props = {
  items: string[];
  onChange: (items: string[]) => void;
  /** What one item is called, e.g. "location". */
  itemName: string;
};

/** A box and an Add button for one more name. Duplicates (any case) are ignored. */
export function AddItem({ items, onChange, itemName }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const add = () => {
    const name = text.trim();
    if (name && !items.some((i) => i.toLowerCase() === name.toLowerCase())) {
      onChange([...items, name]);
    }
    setText('');
  };
  return (
    <View style={styles.addRow}>
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={add}
        returnKeyType="done"
        accessibilityLabel={`New ${itemName}`}
        placeholder={`Add a ${itemName}`}
        placeholderTextColor={colors.textMuted}
        style={[
          type.body,
          styles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />
      <Button label="Add" onPress={add} accessibilityLabel={`Add ${itemName}`} />
    </View>
  );
}

/** Edit a short list of names: tap one to remove it, add by typing. */
export function ListEditor({ items, onChange, itemName }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {items.map((item) => (
          <Pressable
            key={item}
            onPress={() => onChange(items.filter((i) => i !== item))}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item}`}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}>
            <AppText variant="label">{item}</AppText>
            <AppText variant="label" tone="muted">
              ✕
            </AppText>
          </Pressable>
        ))}
      </View>
      {items.length ? (
        <AppText variant="caption" tone="muted">
          Tap a name to remove it. Days already logged keep their {itemName}.
        </AppText>
      ) : null}
      <AddItem items={items} onChange={onChange} itemName={itemName} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: MIN_TAP,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  addRow: { flexDirection: 'row', gap: space.sm },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
  },
  pressed: { opacity: 0.7 },
});
