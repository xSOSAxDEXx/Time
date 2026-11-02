import { Pressable, StyleSheet } from 'react-native';

import { MIN_TAP, radius, space, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  onPress: () => void;
  /** Primary is the blue accent, for the main action on a screen. */
  variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
  /** Fill the row's free space (for buttons side by side). */
  grow?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'secondary',
  disabled,
  grow,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const { colors } = useTheme();
  const look = {
    primary: { backgroundColor: colors.accent, borderColor: colors.accent },
    secondary: { backgroundColor: colors.surface, borderColor: colors.border },
    quiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      aria-disabled={!!disabled}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.button,
        look,
        grow && styles.grow,
        hovered &&
          !disabled &&
          (variant === 'primary' ? styles.hoverPrimary : { backgroundColor: colors.surfaceSoft }),
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <AppText
        variant="label"
        tone={variant === 'quiet' ? 'accent' : 'primary'}
        style={variant === 'primary' && { color: colors.onAccent }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TAP,
    minWidth: MIN_TAP,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  grow: { flex: 1 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  hoverPrimary: { opacity: 0.9 },
});
