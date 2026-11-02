import { formatClock, formatDuration, minutesToHours } from '@/timecard/dates';

import type { GeoAnswer, GeoPrompt } from './engine';

export type PromptText = {
  title: string;
  body: string;
  /** Buttons, most likely answer first. At most 3 (Android's limit for notifications). */
  actions: { answer: GeoAnswer; label: string }[];
};

const time = (ms: number) => {
  const d = new Date(ms);
  return formatClock(d.getHours() + d.getMinutes() / 60);
};
const minutes = (from: number, to: number) => Math.round((to - from) / 60_000);
/** "39 min", "1:15". */
const length = (from: number, to: number) => {
  const m = minutes(from, to);
  return m < 60 ? `${m} min` : formatDuration(minutesToHours(m));
};

/** What a question says, in the notification and on the Week screen. */
export function promptText(p: GeoPrompt): PromptText {
  switch (p.kind) {
    case 'clockIn':
      return {
        title: `At ${p.place}`,
        body: `You arrived at ${time(p.at)}. Clock in at ${time(p.at)}?`,
        actions: [
          { answer: 'yes', label: 'Clock in' },
          { answer: 'dismiss', label: 'Not now' },
        ],
      };
    case 'clockOut':
      return {
        title: `Left ${p.place}`,
        body: `You left at ${time(p.at)}. Clock out at ${time(p.at)}?`,
        actions: [
          { answer: 'yes', label: 'Clock out' },
          { answer: 'break', label: 'On a break' },
        ],
      };
    case 'break': {
      const span = `${time(p.from)} – ${time(p.to)}`;
      const len = length(p.from, p.to);
      return p.clockedOut
        ? {
            title: `Back at ${p.place}`,
            body: `You clocked out at ${time(p.from)}. Were you on a break (${span}, ${len})? That undoes the clock out.`,
            actions: [
              { answer: 'break', label: `Log ${len} break` },
              { answer: 'dismiss', label: 'Stay clocked out' },
            ],
          }
        : {
            title: `Back at ${p.place}`,
            body: `You were away ${span} (${len}). Were you on a break?`,
            actions: [
              { answer: 'break', label: `Log ${len} break` },
              { answer: 'worked', label: 'I was working' },
            ],
          };
    }
    case 'travel': {
      const span = `${time(p.from)} – ${time(p.to)}`;
      const len = length(p.from, p.to);
      return {
        title: `At ${p.toPlace}`,
        body: `Drive from ${p.fromPlace}, ${span} (${len}). Log the drive as time worked?${
          p.clockedOut ? ` That undoes your ${time(p.from)} clock out.` : ''
        }`,
        actions: [
          { answer: 'worked', label: 'Count as worked' },
          { answer: 'break', label: 'Log as break' },
          ...(p.clockedOut ? [{ answer: 'dismiss' as const, label: 'Stay clocked out' }] : []),
        ],
      };
    }
  }
}
