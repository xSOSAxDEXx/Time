import { useColorScheme } from 'react-native';

import { useSettings } from '@/store/settings';

import { palettes, type Palette, type Scheme } from './colors';

/** The palette for the current light/dark mode: Settings → Theme, or the system setting. */
export function useTheme(): { scheme: Scheme; colors: Palette } {
  const system = useColorScheme();
  const choice = useSettings((s) => s.theme);
  const scheme: Scheme = choice === 'system' ? (system === 'dark' ? 'dark' : 'light') : choice;
  return { scheme, colors: palettes[scheme] };
}
