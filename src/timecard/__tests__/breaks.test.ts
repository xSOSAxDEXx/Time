import { addBreak, breakMinutes, formatBreak, removeBreak, usualBreakTime } from '../breaks';
import { emptyEntry } from '../types';

// Made-up days only (CLAUDE.md §7).
const day = { ...emptyEntry('2030-01-07'), start: '08:00', breakHours: 0.25 };

describe('break times', () => {
  it("works out a break's length, past midnight too", () => {
    expect(breakMinutes({ start: '11:30', end: '11:54' })).toBe(24);
    expect(breakMinutes({ start: '23:50', end: '00:20' })).toBe(30);
    expect(breakMinutes({ start: '', end: '11:54' })).toBe(0);
  });

  it('shows a break as two times', () => {
    expect(formatBreak({ start: '11:30', end: '11:54' })).toBe('11:30 AM – 11:54 AM');
  });

  it('places the usual break at its start time, noon if none is set', () => {
    expect(usualBreakTime('12:00', 30)).toEqual({ start: '12:00', end: '12:30' });
    expect(usualBreakTime('11:45', 45)).toEqual({ start: '11:45', end: '12:30' });
    expect(usualBreakTime('', 30)).toEqual({ start: '12:00', end: '12:30' });
  });

  it('adding a break time lists it in order and adds its length to the break', () => {
    const one = { ...day, ...addBreak(day, { start: '14:00', end: '14:15' }) };
    const two = { ...one, ...addBreak(one, { start: '11:30', end: '11:54' }) };
    expect(two.breaks).toEqual([
      { start: '11:30', end: '11:54' },
      { start: '14:00', end: '14:15' },
    ]);
    expect(two.breakHours).toBeCloseTo(0.25 + 15 / 60 + 24 / 60);
  });

  it('removing one takes its length off again', () => {
    const one = { ...day, ...addBreak(day, { start: '11:30', end: '11:54' }) };
    expect(removeBreak(one, 0)).toEqual({ breaks: [], breakHours: 0.25 });
    // Never below zero, and an unknown one changes nothing.
    expect(removeBreak({ ...one, breakHours: 0.1 }, 0).breakHours).toBe(0);
    expect(removeBreak(one, 5)).toEqual({ breaks: one.breaks, breakHours: one.breakHours });
  });
});
