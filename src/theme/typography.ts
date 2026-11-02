import type { TextStyle } from 'react-native';

/**
 * System font (CLAUDE.md §4). Sizes stay unscaled here; React Native applies
 * the user's dynamic type setting on top (allowFontScaling is left on).
 * Numbers use tabular figures so columns of times and hours line up.
 */
const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700', ...tabular },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
  number: { fontSize: 16, lineHeight: 22, fontWeight: '600', ...tabular },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
