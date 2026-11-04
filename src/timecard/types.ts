/** A local calendar date, "YYYY-MM-DD". */
export type DateKey = string;

/** A time of day on the 24-hour clock, "HH:MM". Empty string = not set. */
export type ClockTime = string;

export type Travel = '' | 'Yes' | 'No';

/**
 * A drive between two places from the Locations list (CLAUDE.md §3.13).
 * Miles come from the route in Settings unless set for this trip.
 */
export type Trip = { from: string; to: string; miles?: number };

/** When a break was (owner request, 4 Nov 2026), e.g. 11:30–11:54. */
export type BreakTime = { start: ClockTime; end: ClockTime };

/**
 * One day on the time card (CLAUDE.md §3.1). Mirrors a row of the owner's
 * spreadsheet. Durations are stored in hours, like the spreadsheet; the UI
 * shows the break in minutes.
 */
export type Entry = {
  date: DateKey;
  start: ClockTime;
  end: ClockTime;
  breakHours: number;
  remoteHours: number;
  timeOffHours: number;
  timeOffType: string;
  travel: Travel;
  location: string;
  comment: string;
  /** Drives between places this day. */
  trips?: Trip[];
  /** When the breaks were, in order. Their lengths are included in `breakHours`. */
  breaks?: BreakTime[];
  /** Don't count the company holiday on this date (it's a holiday, but not for you this time). */
  skipHoliday?: boolean;
  /** Set on days filled in automatically from the holiday list (never saved). */
  holiday?: string;
};

export type Entries = Record<DateKey, Entry>;

export function emptyEntry(date: DateKey): Entry {
  return {
    date,
    start: '',
    end: '',
    breakHours: 0,
    remoteHours: 0,
    timeOffHours: 0,
    timeOffType: '',
    travel: '',
    location: '',
    comment: '',
  };
}

/** True when nothing has been logged for the day (so it needn't be stored). */
export function isEmptyEntry(e: Entry): boolean {
  return (
    !e.start &&
    !e.end &&
    !e.breakHours &&
    !e.remoteHours &&
    !e.timeOffHours &&
    !e.timeOffType &&
    !e.travel &&
    !e.location &&
    !e.comment.trim() &&
    !e.trips?.length &&
    !e.breaks?.length &&
    !e.skipHoliday
  );
}
