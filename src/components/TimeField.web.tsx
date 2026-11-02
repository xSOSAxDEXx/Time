import { useTheme } from '@/theme';

import type { TimeFieldProps } from './TimeField';

/** The browser's own time input, which has a clock picker and keyboard entry. */
export function TimeField({ value, onChange, label, compact }: TimeFieldProps) {
  const { colors } = useTheme();
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      style={{
        font: 'inherit',
        fontSize: 16,
        fontVariantNumeric: 'tabular-nums',
        color: colors.text,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        padding: compact ? '6px 6px' : '12px 12px',
        minHeight: compact ? 40 : 48,
        width: compact ? 122 : 160,
        boxSizing: 'border-box',
        colorScheme: 'light dark',
      }}
    />
  );
}
