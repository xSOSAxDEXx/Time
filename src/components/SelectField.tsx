import { ChoiceChips } from './ChoiceChips';

export type SelectFieldProps = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
};

/** A drop-down on the web (SelectField.web.tsx); chips everywhere else. */
export function SelectField(props: SelectFieldProps) {
  return <ChoiceChips {...props} />;
}
