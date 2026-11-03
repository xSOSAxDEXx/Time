import { ChoiceChips } from './ChoiceChips';

export type SelectFieldProps = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  /** The dense size for the computer week table (web only). */
  compact?: boolean;
};

/** A drop-down on the web (SelectField.web.tsx); chips everywhere else. */
export function SelectField({ compact: _compact, ...props }: SelectFieldProps) {
  return <ChoiceChips {...props} />;
}
