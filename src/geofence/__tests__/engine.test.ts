import { emptyEntry, type Entries, type Entry } from '@/timecard/types';

import {
  afterAnswer,
  answerPatch,
  applyEvent,
  EMPTY_GEO_STATE,
  findPrompt,
  visiblePrompts,
  type GeoEvent,
  type GeoState,
} from '../engine';
import { promptText } from '../text';

// Made-up places and times only (CLAUDE.md §7).
const day = (date: string, f: Partial<Entry> = {}): Entry => ({ ...emptyEntry(date), ...f });
const of = (...days: Entry[]): Entries => Object.fromEntries(days.map((d) => [d.date, d]));
const at = (h: number, m = 0) => new Date(2030, 0, 9, h, m).getTime();
const TODAY = '2030-01-09';
const enter = (place: string, h: number, m = 0): GeoEvent => ({
  kind: 'enter',
  place,
  at: at(h, m),
});
const exit = (place: string, h: number, m = 0): GeoEvent => ({ kind: 'exit', place, at: at(h, m) });

/** Runs events in order against a fixed time card. */
function run(entries: Entries, ...events: GeoEvent[]) {
  let state: GeoState = EMPTY_GEO_STATE;
  const results = events.map((e) => {
    const r = applyEvent(state, e, entries);
    state = r.state;
    return r;
  });
  return { state, results, last: results[results.length - 1] };
}

describe('arriving', () => {
  it('asks to clock in when nothing has started today', () => {
    const { last, state } = run({}, enter('Main office', 7, 52));
    expect(last.notify).toMatchObject({ kind: 'clockIn', place: 'Main office', date: TODAY });
    expect(promptText(last.notify!)).toMatchObject({
      title: 'At Main office',
      body: 'You arrived at 7:52 AM. Clock in at 7:52 AM?',
    });
    const patch = answerPatch(last.notify!, 'yes', {});
    expect(patch).toEqual({ start: '07:52', location: 'Main office' });
    expect(visiblePrompts(state, {}, at(8))).toHaveLength(1);
  });

  it('keeps a location that’s already set, and never replaces a start time', () => {
    const { last } = run({}, enter('Main office', 7, 52));
    expect(answerPatch(last.notify!, 'yes', of(day(TODAY, { location: 'Client site' })))).toEqual({
      start: '07:52',
    });
    const started = of(day(TODAY, { start: '07:30' }));
    expect(answerPatch(last.notify!, 'yes', started)).toBeNull();
    expect(visiblePrompts(run({}, enter('Main office', 7, 52)).state, started, at(8))).toEqual([]);
  });

  it('asks nothing when already clocked in, or already worked today', () => {
    expect(run(of(day(TODAY, { start: '07:00' })), enter('Main office', 8)).last.notify).toBeNull();
    expect(
      run(of(day(TODAY, { start: '07:00', end: '15:00' })), enter('Main office', 18)).last.notify,
    ).toBeNull();
  });

  it('ignores the phone repeating an arrival', () => {
    const { results } = run({}, enter('Main office', 7, 52), enter('Main office', 7, 55));
    expect(results[1].notify).toBeNull();
  });
});

describe('leaving and coming back', () => {
  const working = of(day(TODAY, { start: '08:00' }));

  it('a trip of 5 minutes or less is ignored', () => {
    const { results, state } = run(
      working,
      enter('Main office', 8),
      exit('Main office', 10),
      enter('Main office', 10, 5),
    );
    expect(results[1].scheduleClockOut).toMatchObject({ place: 'Main office', at: at(10) });
    expect(results[2]).toMatchObject({ notify: null, cancelClockOut: true });
    expect(visiblePrompts(state, working, at(11))).toEqual([]);
  });

  it('after 5 minutes away, asks to clock out', () => {
    const { state } = run(working, enter('Main office', 8), exit('Main office', 16, 31));
    expect(visiblePrompts(state, working, at(16, 35))).toEqual([]);
    const [p] = visiblePrompts(state, working, at(16, 37));
    expect(promptText(p)).toMatchObject({
      title: 'Left Main office',
      body: 'You left at 4:31 PM. Clock out at 4:31 PM?',
    });
    expect(answerPatch(p, 'yes', working)).toEqual({ end: '16:31' });
    // "On a break" hides it without changing the day.
    expect(answerPatch(p, 'break', working)).toBeNull();
    expect(visiblePrompts(afterAnswer(state, p), working, at(16, 40))).toEqual([]);
  });

  it('back at the same place after more than 5 minutes: was it a break?', () => {
    const { last } = run(
      working,
      enter('Main office', 8),
      exit('Main office', 12, 2),
      enter('Main office', 12, 41),
    );
    expect(last.notify).toMatchObject({ kind: 'break', clockedOut: false });
    expect(last.cancelClockOut).toBe(true);
    expect(promptText(last.notify!)).toMatchObject({
      body: 'You were away 12:02 PM – 12:41 PM (39 min). Were you on a break?',
      actions: [
        { answer: 'break', label: 'Log 39 min break' },
        { answer: 'worked', label: 'I was working' },
      ],
    });
    const withBreak = of(day(TODAY, { start: '08:00', breakHours: 0.25 }));
    expect(answerPatch(last.notify!, 'break', withBreak)).toEqual({ breakHours: 0.25 + 39 / 60 });
    expect(answerPatch(last.notify!, 'worked', withBreak)).toEqual({});
  });

  it('6 minutes away counts', () => {
    const { last } = run(
      working,
      enter('Main office', 8),
      exit('Main office', 12),
      enter('Main office', 12, 6),
    );
    expect(last.notify).toMatchObject({ kind: 'break' });
  });

  it('arriving somewhere else asks about the drive', () => {
    const { last } = run(
      working,
      enter('Main office', 8),
      exit('Main office', 9, 10),
      enter('Client site', 9, 35),
    );
    expect(last.notify).toMatchObject({
      kind: 'travel',
      fromPlace: 'Main office',
      toPlace: 'Client site',
    });
    expect(promptText(last.notify!).body).toBe(
      'Drive from Main office, 9:10 AM – 9:35 AM (25 min). Log the drive as time worked?',
    );
    expect(answerPatch(last.notify!, 'worked', working)).toEqual({ travel: 'Yes' });
    expect(answerPatch(last.notify!, 'break', working)).toEqual({ breakHours: 25 / 60 });
  });

  it('if they clocked out when leaving, coming back offers to undo it', () => {
    const { last } = run(
      of(day(TODAY, { start: '08:00', end: '12:02' })),
      enter('Main office', 8),
      exit('Main office', 12, 2),
      enter('Main office', 12, 41),
    );
    // Clocked out on leaving: no open shift, so no clock-out question was scheduled...
    expect(last.notify).toBeNull();

    // ...but when they said yes to "Clock out?" after leaving, the day ends at the exit time.
    const atExit = of(day(TODAY, { start: '08:00' }));
    const left = run(atExit, enter('Main office', 8), exit('Main office', 12, 2));
    const clockedOut = of(day(TODAY, { start: '08:00', end: '12:02' }));
    const back = applyEvent(left.state, enter('Main office', 12, 41), clockedOut);
    expect(back.notify).toMatchObject({ kind: 'break', clockedOut: true });
    expect(promptText(back.notify!).actions.map((a) => a.label)).toEqual([
      'Log 39 min break',
      'Stay clocked out',
    ]);
    expect(answerPatch(back.notify!, 'break', clockedOut)).toEqual({
      end: '',
      breakHours: 39 / 60,
    });
    expect(answerPatch(back.notify!, 'dismiss', clockedOut)).toBeNull();
  });

  it('leaving with nothing open schedules nothing', () => {
    const { results } = run({}, enter('Main office', 8), exit('Main office', 9));
    expect(results[1].scheduleClockOut).toBeNull();
  });

  it('an "outside" report for a place we were never in is ignored', () => {
    expect(run(working, exit('Main office', 9)).last.scheduleClockOut).toBeNull();
  });

  it('overlapping circles: leaving one while still inside another is not leaving', () => {
    const { results } = run(
      working,
      enter('Main office', 8),
      enter('Vendor', 8, 1),
      exit('Vendor', 9),
    );
    expect(results[2].scheduleClockOut).toBeNull();
  });

  it('old questions are dropped', () => {
    const { state } = run({}, enter('Main office', 7, 52));
    expect(visiblePrompts(state, {}, at(7, 52) + 19 * 3600_000)).toEqual([]);
  });
});

describe('GPS blips at the edge of a circle', () => {
  const working = of(day(TODAY, { start: '08:00' }));

  it('a return asks only once they have been back 3 minutes', () => {
    const { last, state } = run(
      working,
      enter('Main office', 8),
      exit('Main office', 12),
      enter('Main office', 12, 30),
    );
    expect(last.notifyAt).toBe(at(12, 33));
    expect(visiblePrompts(state, working, at(12, 32))).toEqual([]);
    expect(visiblePrompts(state, working, at(12, 33))).toMatchObject([{ kind: 'break' }]);
  });

  it('back for a moment and gone again: the same trip, not asked again', () => {
    const { state, results } = run(working, enter('Main office', 8), exit('Main office', 12));
    // "On a break" answered on the 12:05 "Clock out?".
    const [out] = visiblePrompts(state, working, at(12, 6));
    let s = afterAnswer(state, out, 'break');
    expect(results[1].scheduleClockOut).not.toBeNull();

    // The phone thinks they're back at 12:10, then gone at 12:11.
    const blipIn = applyEvent(s, enter('Main office', 12, 10), working);
    s = blipIn.state;
    const blipOut = applyEvent(s, exit('Main office', 12, 11), working);
    s = blipOut.state;
    expect(blipOut.cancelPromptId).toBe(blipIn.notify!.id);
    expect(blipOut.scheduleClockOut).toBeNull();
    expect(s.pendingExit).toMatchObject({ at: at(12), answered: true });
    expect(visiblePrompts(s, working, at(12, 20))).toEqual([]);

    // Really back at 12:30: one question, for the whole break.
    const back = applyEvent(s, enter('Main office', 12, 30), working);
    expect(back.notify).toMatchObject({ kind: 'break', from: at(12), to: at(12, 30) });
    expect(visiblePrompts(back.state, working, at(12, 40))).toHaveLength(1);
  });

  it('"Clock out?" answered after coming back still counts', () => {
    const { state, last } = run(
      working,
      enter('Main office', 8),
      exit('Main office', 12),
      enter('Main office', 12, 30),
    );
    const id = `clockOut-${at(12)}`;
    const out = findPrompt(state, working, id, at(12, 31));
    expect(out).toMatchObject({ kind: 'clockOut', at: at(12) });
    const s = afterAnswer(state, out!, 'break');
    expect(s.prompts.find((p) => p.id === last.notify!.id)).toMatchObject({
      exit: { answered: true },
    });
    expect(findPrompt(s, working, id, at(12, 32))).toBeNull();
  });
});

describe('a break on top of the usual break', () => {
  const working = of(day(TODAY, { start: '08:00' }));
  const back = (entries: Entries) => {
    let s: GeoState = EMPTY_GEO_STATE;
    for (const e of [
      enter('Main office', 8),
      exit('Main office', 12),
      enter('Main office', 12, 20),
    ])
      s = applyEvent(s, e, entries, 0.5).state;
    return s.prompts[0];
  };

  it('offers "plus usual" when a usual break is set and none is logged', () => {
    const p = back(working);
    expect(promptText(p)).toMatchObject({
      body: 'You were away 12:00 PM – 12:20 PM (20 min). Were you on a break? Log just this, or this on top of your usual 30 min break.',
      actions: [
        { answer: 'break', label: 'Log 20 min break' },
        { answer: 'extra', label: 'Log 20 min + usual 30 min' },
        { answer: 'worked', label: 'I was working' },
      ],
    });
    expect(answerPatch(p, 'break', working)).toEqual({ breakHours: 20 / 60 });
    expect(answerPatch(p, 'extra', working)).toEqual({ breakHours: 0.5 + 20 / 60 });
  });

  it('is not offered once a break is logged', () => {
    const withBreak = of(day(TODAY, { start: '08:00', breakHours: 0.25 }));
    const p = back(withBreak);
    expect(promptText(p).actions.map((a) => a.answer)).toEqual(['break', 'worked']);
  });
});
