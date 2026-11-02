import { useColorScheme } from 'react-native';

import { palettes, type Palette, type Scheme } from './colors';

/**
 * The palette for the current light/dark mode. Follows the system setting;
 * the Settings screen's theme override comes in step 4 (CLAUDE.md §3.6).
 */
export function useTheme(): { scheme: Scheme; colors: Palette } {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: palettes[scheme] };
}
