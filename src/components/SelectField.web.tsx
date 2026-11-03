import { useTheme } from '@/theme';

import type { SelectFieldProps } from './SelectField';

export function SelectField({ options, value, onChange, label, compact }: SelectFieldProps) {
  const { colors } = useTheme();
  const all = value && !options.includes(value) ? [...options, value] : options;
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      style={{
        font: 'inherit',
        fontSize: 14,
        color: colors.text,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        minHeight: compact ? 40 : 48,
        width: '100%',
        maxWidth: compact ? 140 : 320,
        padding: '0 4px',
        colorScheme: 'light dark',
      }}>
      <option value="" />
      {all.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
