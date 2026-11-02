import '@/geofence/task';
import { useEntries } from '@/store/entries';
import { useGeo } from '@/store/geo';
import { useSettings } from '@/store/settings';
import { emptyEntry } from '@/timecard/types';

import { EMPTY_GEO_STATE } from '../engine';
import { answerGeoPrompt } from '../handle';
import { GEOFENCE_TASK } from '../native';

const taskManager = jest.requireMock('expo-task-manager') as {
  __tasks: Map<string, (body: unknown) => Promise<void>>;
};
const notifications = jest.requireMock('expo-notifications') as {
  __scheduled: Map<
    string,
    {
      content: { title: string; body: string; categoryIdentifier: string };
      trigger: { date: number } | null;
    }
  >;
};

// Made-up place and times only (CLAUDE.md §7).
const run = (eventType: 1 | 2, place = 'Main office') =>
  taskManager.__tasks.get(GEOFENCE_TASK)!({
    data: { eventType, region: { identifier: place } },
    error: null,
    executionInfo: {},
  });
const ENTER = 1;
const EXIT = 2;

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2030, 0, 9, 7, 52) });
  useSettings.getState().replaceAll({ holidays: [], geofencing: true });
  useEntries.setState({ entries: {} });
  useGeo.getState().set(EMPTY_GEO_STATE);
  notifications.__scheduled.clear();
});
afterEach(() => jest.useRealTimers());

describe('the background task', () => {
  it('arriving sends "Clock in?", and answering it logs the arrival time', async () => {
    await run(ENTER);
    const [prompt] = useGeo.getState().prompts;
    expect(prompt).toMatchObject({ kind: 'clockIn', place: 'Main office' });
    const sent = notifications.__scheduled.get(prompt.id)!;
    expect(sent.trigger).toBeNull();
    expect(sent.content).toMatchObject({
      title: 'At Main office',
      body: 'You arrived at 7:52 AM. Clock in at 7:52 AM?',
      categoryIdentifier: 'geo-clockIn',
    });

    // Answered a few minutes later: the arrival time is what's logged.
    jest.setSystemTime(new Date(2030, 0, 9, 8, 5));
    await answerGeoPrompt(prompt.id, 'yes');
    expect(useEntries.getState().entries['2030-01-09']).toMatchObject({
      start: '07:52',
      location: 'Main office',
    });
    expect(useGeo.getState().prompts).toEqual([]);
    // Answering again does nothing.
    await answerGeoPrompt(prompt.id, 'yes');
  });

  it('leaving schedules "Clock out?" for 5 minutes later; coming back sooner cancels it', async () => {
    useEntries.setState({
      entries: { '2030-01-09': { ...emptyEntry('2030-01-09'), start: '07:52' } },
    });
    await run(ENTER);
    jest.setSystemTime(new Date(2030, 0, 9, 12, 0));
    await run(EXIT);
    const scheduled = notifications.__scheduled.get('geo-clock-out')!;
    expect(scheduled.trigger!.date).toBe(new Date(2030, 0, 9, 12, 5, 1).getTime());
    expect(scheduled.content.body).toBe('You left at 12:00 PM. Clock out at 12:00 PM?');

    jest.setSystemTime(new Date(2030, 0, 9, 12, 3));
    await run(ENTER);
    expect(notifications.__scheduled.has('geo-clock-out')).toBe(false);
    expect(useGeo.getState().prompts).toEqual([]);
  });

  it('a longer absence asks about the break, and the answer logs it', async () => {
    useEntries.setState({
      entries: { '2030-01-09': { ...emptyEntry('2030-01-09'), start: '07:52' } },
    });
    await run(ENTER);
    jest.setSystemTime(new Date(2030, 0, 9, 12, 2));
    await run(EXIT);
    jest.setSystemTime(new Date(2030, 0, 9, 12, 41));
    await run(ENTER);
    const [prompt] = useGeo.getState().prompts;
    expect(prompt.kind).toBe('break');
    // Sent once they've been back 3 minutes.
    expect(notifications.__scheduled.get(prompt.id)!.trigger!.date).toBe(
      new Date(2030, 0, 9, 12, 44).getTime(),
    );
    await answerGeoPrompt(prompt.id, 'break');
    expect(useEntries.getState().entries['2030-01-09'].breakHours).toBeCloseTo(39 / 60);
  });

  it('a blip back inside takes back the break question and keeps the trip going', async () => {
    useEntries.setState({
      entries: { '2030-01-09': { ...emptyEntry('2030-01-09'), start: '07:52' } },
    });
    await run(ENTER);
    jest.setSystemTime(new Date(2030, 0, 9, 12, 0));
    await run(EXIT);
    jest.setSystemTime(new Date(2030, 0, 9, 12, 6));
    await answerGeoPrompt(`clockOut-${new Date(2030, 0, 9, 12, 0).getTime()}`, 'break');
    jest.setSystemTime(new Date(2030, 0, 9, 12, 10));
    await run(ENTER);
    const [blip] = useGeo.getState().prompts;
    jest.setSystemTime(new Date(2030, 0, 9, 12, 11));
    await run(EXIT);
    expect(notifications.__scheduled.has(blip.id)).toBe(false);
    expect(notifications.__scheduled.has('geo-clock-out')).toBe(false);
    expect(useGeo.getState().pendingExit).toMatchObject({ answered: true });
  });

  it('offers the usual break on top, and logs both', async () => {
    useSettings.getState().update({ usualBreakMinutes: 30 });
    useEntries.setState({
      entries: { '2030-01-09': { ...emptyEntry('2030-01-09'), start: '07:52' } },
    });
    await run(ENTER);
    jest.setSystemTime(new Date(2030, 0, 9, 12, 0));
    await run(EXIT);
    jest.setSystemTime(new Date(2030, 0, 9, 12, 15));
    await run(ENTER);
    const [prompt] = useGeo.getState().prompts;
    expect(notifications.__scheduled.get(prompt.id)!.content.categoryIdentifier).toBe(
      'geo-break-usual',
    );
    await answerGeoPrompt(prompt.id, 'extra');
    expect(useEntries.getState().entries['2030-01-09'].breakHours).toBeCloseTo(0.75);
  });

  it('does nothing while arrive-and-leave is off', async () => {
    useSettings.getState().update({ geofencing: false });
    await run(ENTER);
    expect(useGeo.getState().prompts).toEqual([]);
    expect(notifications.__scheduled.size).toBe(0);
  });
});
