import { palettes, type Palette } from '../colors';

/** WCAG relative luminance of a #RRGGBB colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each(Object.entries(palettes) as [string, Palette][])('%s palette', (_name, p) => {
  it.each(['background', 'surface', 'today', 'surfaceSoft'] as const)(
    'body and muted text are readable on %s (WCAG AA)',
    (surface) => {
      expect(contrast(p.text, p[surface])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.textMuted, p[surface])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('button text is readable on the accent', () => {
    expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['good', 'warn', 'bad', 'accent'] as const)('%s is readable as text on cards', (c) => {
    expect(contrast(p[c], p.surface)).toBeGreaterThanOrEqual(4.5);
  });
});
