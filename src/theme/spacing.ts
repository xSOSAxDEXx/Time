export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Smallest touch target anywhere in the app. */
export const MIN_TAP = 48;

/** Phone-style content never stretches wider than this on big screens. */
export const MAX_CONTENT_WIDTH = 760;

/** At or above this window width the week shows as a full table (CLAUDE.md §3.3). */
export const WIDE_BREAKPOINT = 1024;
