import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { radius, space, type, useTheme } from '@/theme';

type Props = {
  value: string;
  /** Called with the trimmed text when editing finishes (blur or done). */
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
} & Pick<TextInputProps, 'autoCapitalize' | 'autoComplete' | 'keyboardType'>;

/** A one-line text box that saves when you leave it. */
export function TextField({ value, onChange, label, placeholder, ...rest }: Props) {
  const { colors } = useTheme();
  // What's being typed; null when not editing, so the saved value shows.
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft != null && draft.trim() !== value) onChange(draft.trim());
    setDraft(null);
  };
  return (
    <TextInput
      {...rest}
      value={draft ?? value}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      returnKeyType="done"
      accessibilityLabel={label}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      style={[
        type.body,
        styles.input,
        { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: space.md },
});
