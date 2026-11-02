/**
 * Arrive-and-leave prompts (CLAUDE.md §3.11). Pure, like calc.ts: given what
 * the phone saw (arriving at or leaving a place) and the time card, decide
 * what to ask. Nothing is ever logged without the person saying yes.
 *
 * - Arrive somewhere with nothing started today: "Clock in?"
 * - Leave while clocked in: after 5 minutes away, "Clock out?"
 * - Back within 5 minutes: nothing (a trip to the car).
 * - Back at the same place after longer: "Were you on a break?"
 * - Arrive at a different place: "Log the drive as time worked?"
 */
import { isInProgress } from '@/timecard/calc';
import { clockOutDate } from '@/timecard/clock';
import { clockTimeOf, minutesToHours, toKey } from '@/timecard/dates';
import type { DateKey, Entries, Entry } from '@/timecard/types';

/** A place from the Locations list with its circle on the map. */
export type GeoPlace = {
  /** The location's name in Settings → Lists. */
  location: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export const RADIUS_CHOICES = [100, 150, 250, 500] as const;
export const DEFAULT_RADIUS = 150;

/** Absences this long or shorter are ignored (owner's rule: more than 5 minutes counts). */
export const MIN_ABSENCE_MS = 5 * 60_000;

/** A repeat "arrived" for the same place within this time is the phone re-sending it. */
export const DUPLICATE_ENTER_MS = 10 * 60_000;

/** Questions older than this are dropped. */
export const PROMPT_MAX_AGE_MS = 18 * 3600_000;

export type GeoEvent = { kind: 'enter' | 'exit'; place: string; at: number };

export type PendingExit = {
  place: string;
  at: number;
  /** The shift's day (yesterday's, for an overnight shift). */
  date: DateKey;
  /** Answered "On a break" (or "Clock out"), so the clock-out card is hidden. */
  answered?: boolean;
};

export type GeoPrompt =
  | { id: string; kind: 'clockIn'; date: DateKey; place: string; at: number }
  | {
      id: string;
      kind: 'break';
      date: DateKey;
      place: string;
      from: number;
      to: number;
      /** They said yes to "Clock out?" when they left. */
      clockedOut: boolean;
    }
  | {
      id: string;
      kind: 'travel';
      date: DateKey;
      fromPlace: string;
      toPlace: string;
      from: number;
      to: number;
      clockedOut: boolean;
    }
  | { id: string; kind: 'clockOut'; date: DateKey; place: string; at: number };

export type GeoState = {
  /** Places the phone says we're inside, with when we arrived. */
  inside: Record<string, number>;
  pendingExit: PendingExit | null;
  /** Questions waiting for an answer (clock out is worked out from pendingExit). */
  prompts: GeoPrompt[];
};

export const EMPTY_GEO_STATE: GeoState = { inside: {}, pendingExit: null, prompts: [] };

export type EventResult = {
  state: GeoState;
  /** A question to send as a notification now. */
  notify: GeoPrompt | null;
  /** Schedule the "Clock out?" notification for 5 minutes after leaving. */
  scheduleClockOut: PendingExit | null;
  /** Cancel the scheduled "Clock out?" notification. */
  cancelClockOut: boolean;
};

const openShift = (entries: Entries, date: DateKey): Entry | null => {
  const e = entries[date];
  return e && isInProgress(e) ? e : null;
};

/** The shift that's open at `at`, if any (today's, or last night's overnight one). */
function shiftAt(entries: Entries, at: number): { date: DateKey; entry: Entry } | null {
  const date = clockOutDate(entries, toKey(new Date(at)));
  const entry = openShift(entries, date);
  return entry ? { date, entry } : null;
}

const fresh = (prompts: GeoPrompt[], now: number) =>
  prompts.filter((p) => now - promptTime(p) <= PROMPT_MAX_AGE_MS);

export function promptTime(p: GeoPrompt): number {
  return p.kind === 'break' || p.kind === 'travel' ? p.to : p.at;
}

/** What to do about one arrive/leave event. */
export function applyEvent(state: GeoState, event: GeoEvent, entries: Entries): EventResult {
  const none = { notify: null, scheduleClockOut: null, cancelClockOut: false };
  const prompts = fresh(state.prompts, event.at);

  if (event.kind === 'exit') {
    // Only a place we were in can be left (the phone may report "outside" on start-up).
    if (state.inside[event.place] == null) return { state, ...none };
    const inside = { ...state.inside };
    delete inside[event.place];
    // Still inside another overlapping circle: not really gone.
    if (Object.keys(inside).length) return { state: { ...state, inside, prompts }, ...none };
    const shift = shiftAt(entries, event.at);
    const pendingExit = shift ? { place: event.place, at: event.at, date: shift.date } : null;
    return {
      state: { inside, pendingExit, prompts },
      ...none,
      scheduleClockOut: pendingExit,
      cancelClockOut: !pendingExit && !!state.pendingExit,
    };
  }

  // Arriving.
  const before = state.inside[event.place];
  if (before != null && event.at - before < DUPLICATE_ENTER_MS) return { state, ...none };
  const inside = { ...state.inside, [event.place]: event.at };
  const pe = state.pendingExit;
  const base = { inside, pendingExit: null, prompts };
  const cancelClockOut = !!pe;

  if (pe) {
    const away = event.at - pe.at;
    if (away <= MIN_ABSENCE_MS) return { state: base, ...none, cancelClockOut };
    const e = entries[pe.date];
    const stillOpen = !!e && isInProgress(e);
    const clockedOut = !!e && !!e.end && e.end === clockTimeOf(new Date(pe.at));
    if (stillOpen || clockedOut) {
      const prompt: GeoPrompt =
        pe.place === event.place
          ? {
              id: `break-${event.at}`,
              kind: 'break',
              date: pe.date,
              place: event.place,
              from: pe.at,
              to: event.at,
              clockedOut,
            }
          : {
              id: `travel-${event.at}`,
              kind: 'travel',
              date: pe.date,
              fromPlace: pe.place,
              toPlace: event.place,
              from: pe.at,
              to: event.at,
              clockedOut,
            };
      return {
        state: { ...base, prompts: [...prompts, prompt] },
        notify: prompt,
        scheduleClockOut: null,
        cancelClockOut,
      };
    }
  }

  // Already working, or already clocked in earlier today: nothing to ask.
  const today = toKey(new Date(event.at));
  if (shiftAt(entries, event.at) || entries[today]?.start) {
    return { state: base, ...none, cancelClockOut };
  }
  const prompt: GeoPrompt = {
    id: `clockIn-${event.at}`,
    kind: 'clockIn',
    date: today,
    place: event.place,
    at: event.at,
  };
  return {
    // One "Clock in?" at a time: the latest arrival replaces an older one.
    state: { ...base, prompts: [...prompts.filter((p) => p.kind !== 'clockIn'), prompt] },
    notify: prompt,
    scheduleClockOut: null,
    cancelClockOut,
  };
}

/** The "Clock out?" question, once someone has been gone more than 5 minutes. */
export function clockOutPrompt(state: GeoState, entries: Entries, now: number): GeoPrompt | null {
  const pe = state.pendingExit;
  if (!pe || pe.answered || now - pe.at <= MIN_ABSENCE_MS) return null;
  if (!openShift(entries, pe.date)) return null;
  return { id: `clockOut-${pe.at}`, kind: 'clockOut', date: pe.date, place: pe.place, at: pe.at };
}

/** Whether a stored question still makes sense with the time card as it is now. */
export function stillValid(p: GeoPrompt, entries: Entries): boolean {
  const e = entries[p.date];
  switch (p.kind) {
    case 'clockIn':
      return !e?.start;
    case 'clockOut':
      return !!e && isInProgress(e);
    case 'break':
    case 'travel':
      return !!e?.start && (p.clockedOut ? !!e.end : isInProgress(e));
  }
}

/** The questions to show now, oldest first. */
export function visiblePrompts(state: GeoState, entries: Entries, now: number): GeoPrompt[] {
  const out = fresh(state.prompts, now).filter((p) => stillValid(p, entries));
  const out2 = clockOutPrompt(state, entries, now);
  return (out2 ? [...out, out2] : out).sort((a, b) => promptTime(a) - promptTime(b));
}

/** How a question can be answered. */
export type GeoAnswer = 'yes' | 'break' | 'worked' | 'dismiss';

const minutesBetween = (from: number, to: number) => Math.round((to - from) / 60_000);

/**
 * The change an answer makes to the day, or null for none. `entries` is the
 * time card now; a time that's already set is never overwritten.
 */
export function answerPatch(
  p: GeoPrompt,
  answer: GeoAnswer,
  entries: Entries,
): Partial<Omit<Entry, 'date'>> | null {
  if (!stillValid(p, entries) || answer === 'dismiss') return null;
  const e = entries[p.date];
  switch (p.kind) {
    case 'clockIn':
      if (answer !== 'yes') return null;
      return { start: clockTimeOf(new Date(p.at)), ...(e?.location ? {} : { location: p.place }) };
    case 'clockOut':
      return answer === 'yes' ? { end: clockTimeOf(new Date(p.at)) } : null;
    case 'break':
    case 'travel': {
      if (!e) return null;
      const reopen = p.clockedOut ? { end: '' } : {};
      const away = minutesToHours(minutesBetween(p.from, p.to));
      if (answer === 'break') return { ...reopen, breakHours: e.breakHours + away };
      if (answer === 'worked')
        return { ...reopen, ...(p.kind === 'travel' ? { travel: 'Yes' as const } : {}) };
      return null;
    }
  }
}

/** The state after a question is answered (or dismissed). */
export function afterAnswer(state: GeoState, p: GeoPrompt): GeoState {
  if (p.kind === 'clockOut') {
    return state.pendingExit && state.pendingExit.at === p.at
      ? { ...state, pendingExit: { ...state.pendingExit, answered: true } }
      : state;
  }
  return { ...state, prompts: state.prompts.filter((x) => x.id !== p.id) };
}

/** Finds a question by id, including the worked-out clock-out one. */
export function findPrompt(
  state: GeoState,
  entries: Entries,
  id: string,
  now: number,
): GeoPrompt | null {
  return (
    state.prompts.find((p) => p.id === id) ??
    (clockOutPrompt(state, entries, now)?.id === id ? clockOutPrompt(state, entries, now) : null)
  );
}
