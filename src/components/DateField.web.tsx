import { useTheme } from '@/theme';

import type { DateFieldProps } from './DateField';

export function DateField({ value, onChange, label }: DateFieldProps) {
  const { colors } = useTheme();
  return (
    <input
      type="date"
      aria-label={label}
      value={value}
      onChange={(e) => e.currentTarget.value && onChange(e.currentTarget.value)}
      style={{
        font: 'inherit',
        fontSize: 15,
        color: colors.text,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: '0 10px',
        minHeight: 48,
        boxSizing: 'border-box',
        colorScheme: 'light dark',
      }}
    />
  );
}
