/**
 * Light and dark palettes, carried over from the time card HTML page.
 * `src/theme/__tests__/colors.test.ts` checks text contrast in both.
 */
const light = {
  // Surfaces
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceSoft: '#EEF3FF', // highlighted rows, selected chips
  today: '#FFF7D6', // today's row
  weekend: '#F9FAFB',
  border: '#E2E6EB',

  // Text
  text: '#1B1F24',
  textMuted: '#5F6B7A',

  // Accent (buttons, links, active tab)
  accent: '#2563EB',
  onAccent: '#FFFFFF',

  // Status (always paired with a word or icon, never colour alone)
  good: '#15803D', // target met
  warn: '#B45309', // not yet
  bad: '#B91C1C',

  // Charts
  chart: {
    onSite: '#2A78D6',
    timeOff: '#EB6834',
    remote: '#1BAF7A',
    grid: '#ECEEF1',
    reference: '#8A94A3',
  },
};

export type Palette = typeof light;

const dark: Palette = {
  background: '#0F1216',
  surface: '#171B21',
  surfaceSoft: '#1C2536',
  today: '#2B2715',
  weekend: '#13171C',
  border: '#2A313A',

  text: '#E7EAEE',
  textMuted: '#9AA5B1',

  accent: '#5B8CFF',
  onAccent: '#0B0E12',

  good: '#4ADE80',
  warn: '#FBBF24',
  bad: '#F87171',

  chart: {
    onSite: '#3987E5',
    timeOff: '#D95926',
    remote: '#199E70',
    grid: '#232A32',
    reference: '#6B7684',
  },
};

export const palettes = { light, dark } as const;
export type Scheme = keyof typeof palettes;
