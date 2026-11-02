import { emptyEntry, type Entries, type Entry } from '@/timecard/types';

import { hoursPhrase, reminderPlan, type ReminderOptions } from '../plan';

// Made-up days only (CLAUDE.md §7: no personal data in tests).
const day = (date: string, f: Partial<Entry> = {}): Entry => ({ ...emptyEntry(date), ...f });
const of = (...days: Entry[]): Entries => Object.fromEntries(days.map((d) => [d.date, d]));
const opts = (o: Partial<ReminderOptions> = {}): ReminderOptions => ({
  enabled: true,
  leadMinutes: 0,
  requiredHours: 8,
  usualBreakHours: 0,
  ...o,
});
const TODAY = '2030-01-09';

describe('reminderPlan', () => {
  it('reminds at min clock out while clocked in', () => {
    const plan = reminderPlan(of(day(TODAY, { start: '08:00' })), TODAY, opts());
    expect(plan).toMatchObject({
      date: TODAY,
      title: 'Time to clock out',
      body: "You've hit your 8 hours. You can clock out.",
    });
    expect(plan!.fireAt).toEqual(new Date(2030, 0, 9, 16, 0));
    expect(plan!.minOut).toEqual(plan!.fireAt);
  });

  it('follows the break, remote work, time off and the usual break', () => {
    const plan = reminderPlan(
      of(day(TODAY, { start: '08:00', breakHours: 0.5, remoteHours: 1, timeOffHours: 2 })),
      TODAY,
      opts(),
    );
    expect(plan!.fireAt).toEqual(new Date(2030, 0, 9, 13, 30));
    const usual = reminderPlan(
      of(day(TODAY, { start: '08:00' })),
      TODAY,
      opts({ usualBreakHours: 0.5 }),
    );
    expect(usual!.fireAt).toEqual(new Date(2030, 0, 9, 16, 30));
  });

  it('reminds a few minutes early when asked', () => {
    const plan = reminderPlan(of(day(TODAY, { start: '08:00' })), TODAY, opts({ leadMinutes: 10 }));
    expect(plan!.fireAt).toEqual(new Date(2030, 0, 9, 15, 50));
    expect(plan!.title).toBe('Almost time to clock out');
    expect(plan!.body).toBe('10 minutes until you hit your 8 hours. Min clock out is 4:00 PM.');
  });

  it('handles overnight shifts, including just after midnight', () => {
    const night = of(day('2030-01-08', { start: '22:00' }));
    // Still the evening it started.
    expect(reminderPlan(night, '2030-01-08', opts())!.fireAt).toEqual(new Date(2030, 0, 9, 6, 0));
    // After midnight, yesterday's open shift is the one to remind about.
    const plan = reminderPlan(night, TODAY, opts());
    expect(plan!.date).toBe('2030-01-08');
    expect(plan!.fireAt).toEqual(new Date(2030, 0, 9, 6, 0));
  });

  it('has nothing to remind about when off, not clocked in or clocked out', () => {
    expect(
      reminderPlan(of(day(TODAY, { start: '08:00' })), TODAY, opts({ enabled: false })),
    ).toBeNull();
    expect(reminderPlan({}, TODAY, opts())).toBeNull();
    expect(reminderPlan(of(day(TODAY, { timeOffHours: 8 })), TODAY, opts())).toBeNull();
    expect(
      reminderPlan(of(day(TODAY, { start: '08:00', end: '16:00' })), TODAY, opts()),
    ).toBeNull();
  });

  it('changes its key whenever the time changes', () => {
    const a = reminderPlan(of(day(TODAY, { start: '08:00' })), TODAY, opts());
    const b = reminderPlan(of(day(TODAY, { start: '08:00', breakHours: 0.5 })), TODAY, opts());
    expect(a!.key).not.toBe(b!.key);
  });

  it('says hours plainly', () => {
    expect([hoursPhrase(8), hoursPhrase(7.5), hoursPhrase(1)]).toEqual([
      '8 hours',
      '7.5 hours',
      '1 hour',
    ]);
  });
});
