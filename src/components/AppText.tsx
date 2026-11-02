import { Text, type TextProps } from 'react-native';

import { type TypeVariant, type, useTheme } from '@/theme';

type Tone = 'primary' | 'muted' | 'accent' | 'good' | 'warn' | 'bad';

export type AppTextProps = TextProps & {
  variant?: TypeVariant;
  tone?: Tone;
};

/** How far each size may grow with the phone's text-size setting (dynamic type). */
const maxScale: Partial<Record<TypeVariant, number>> = { display: 1.4, title: 1.6 };

/** All text in the app goes through this so sizes and colours stay consistent. */
export function AppText({ variant = 'body', tone = 'primary', style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const color = {
    primary: colors.text,
    muted: colors.textMuted,
    accent: colors.accent,
    good: colors.good,
    warn: colors.warn,
    bad: colors.bad,
  }[tone];
  return (
    <Text
      maxFontSizeMultiplier={maxScale[variant]}
      {...rest}
      style={[type[variant], { color }, style]}
    />
  );
}
