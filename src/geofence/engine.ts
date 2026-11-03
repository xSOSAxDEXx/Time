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
 *
 * A return only counts once you've been back 3 minutes: near the edge of a
 * circle the phone can briefly think you're inside, and leaving again that
 * soon carries on the same trip (same leave time, same answers).
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

/** How long you must be back before a return counts (GPS blips at a circle's edge). */
export const RETURN_SETTLE_MS = 3 * 60_000;

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
      /** The usual break (hours) that can be added on top; 0 when it doesn't apply. */
      usualHours?: number;
      /** The trip this return ends, to carry on if they leave again right away. */
      exit?: PendingExit;
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
      exit?: PendingExit;
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
  /** A question to send as a notification. */
  notify: GeoPrompt | null;
  /** When to send it (null: now). */
  notifyAt: number | null;
  /** A question to take back (its notification hasn't been sent yet). */
  cancelPromptId: string | null;
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
  return isReturn(p) ? p.to : p.at;
}

type ReturnPrompt = Extract<GeoPrompt, { kind: 'break' | 'travel' }>;
const isReturn = (p: GeoPrompt): p is ReturnPrompt => p.kind === 'break' || p.kind === 'travel';
const arrivedAt = (p: ReturnPrompt) => (p.kind === 'break' ? p.place : p.toPlace);
/** Back less than 3 minutes: the return might be a GPS blip. */
const settling = (p: GeoPrompt, now: number) => isReturn(p) && now - p.to < RETURN_SETTLE_MS;

/**
 * What to do about one arrive/leave event. `usualBreakHours` is the usual
 * break from Settings, offered on top of a break when none is logged yet.
 */
export function applyEvent(
  state: GeoState,
  event: GeoEvent,
  entries: Entries,
  usualBreakHours = 0,
): EventResult {
  const none = {
    notify: null,
    notifyAt: null,
    cancelPromptId: null,
    scheduleClockOut: null,
    cancelClockOut: false,
  };
  const prompts = fresh(state.prompts, event.at);

  if (event.kind === 'exit') {
    // Only a place we were in can be left (the phone may report "outside" on start-up).
    if (state.inside[event.place] == null) return { state, ...none };
    const inside = { ...state.inside };
    delete inside[event.place];
    // Still inside another overlapping circle: not really gone.
    if (Object.keys(inside).length) return { state: { ...state, inside, prompts }, ...none };
    // Back only a moment: the trip carries on, with the answers already given.
    const blip = prompts.find(
      (p): p is ReturnPrompt =>
        isReturn(p) && !!p.exit && arrivedAt(p) === event.place && settling(p, event.at),
    );
    if (blip?.exit) {
      return {
        state: { inside, pendingExit: blip.exit, prompts: prompts.filter((p) => p !== blip) },
        ...none,
        cancelPromptId: blip.id,
      };
    }
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
              usualHours: usualBreakHours > 0 && !e.breakHours ? usualBreakHours : 0,
              exit: pe,
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
              exit: pe,
            };
      return {
        state: { ...base, prompts: [...prompts, prompt] },
        // Asked once they've been back long enough to be sure.
        notify: prompt,
        notifyAt: event.at + RETURN_SETTLE_MS,
        cancelPromptId: null,
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
    notifyAt: null,
    cancelPromptId: null,
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
  const out = fresh(state.prompts, now).filter((p) => stillValid(p, entries) && !settling(p, now));
  const out2 = clockOutPrompt(state, entries, now);
  return (out2 ? [...out, out2] : out).sort((a, b) => promptTime(a) - promptTime(b));
}

/** How a question can be answered. */
export type GeoAnswer = 'yes' | 'break' | 'extra' | 'worked' | 'dismiss';

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
      // A drive is recorded as a trip either way, for miles and gas (§3.13).
      const trip =
        p.kind === 'travel' && (answer === 'worked' || answer === 'break' || answer === 'extra')
          ? { trips: [...(e.trips ?? []), { from: p.fromPlace, to: p.toPlace }] }
          : {};
      if (answer === 'break') return { ...reopen, ...trip, breakHours: e.breakHours + away };
      // On top of the usual break (only while no other break is logged).
      if (answer === 'extra') {
        const usual = p.kind === 'break' && !e.breakHours ? (p.usualHours ?? 0) : 0;
        return { ...reopen, ...trip, breakHours: e.breakHours + usual + away };
      }
      if (answer === 'worked')
        return { ...reopen, ...trip, ...(p.kind === 'travel' ? { travel: 'Yes' as const } : {}) };
      return null;
    }
  }
}

/** The state after a question is answered (or dismissed). */
export function afterAnswer(state: GeoState, p: GeoPrompt, answer?: GeoAnswer): GeoState {
  if (p.kind === 'clockOut') {
    if (state.pendingExit && state.pendingExit.at === p.at)
      return { ...state, pendingExit: { ...state.pendingExit, answered: true } };
    // Answered after coming back: remember it on that trip's return question.
    return {
      ...state,
      prompts: state.prompts.map((x) =>
        isReturn(x) && x.exit?.at === p.at
          ? {
              ...x,
              exit: { ...x.exit, answered: true },
              ...(answer === 'yes' ? { clockedOut: true } : {}),
            }
          : x,
      ),
    };
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
  const found = state.prompts.find((p) => p.id === id);
  if (found) return found;
  const out = clockOutPrompt(state, entries, now);
  if (out?.id === id) return out;
  // "Clock out?" answered from its notification after they'd already come back.
  for (const p of state.prompts) {
    const pe = isReturn(p) ? p.exit : undefined;
    if (pe && !pe.answered && `clockOut-${pe.at}` === id && openShift(entries, pe.date))
      return { id, kind: 'clockOut', date: pe.date, place: pe.place, at: pe.at };
  }
  return null;
}
