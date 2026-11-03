import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Platform } from 'react-native';

import { EMPTY_GEO_STATE } from '@/geofence/engine';
import { useEntries } from '@/store/entries';
import { useGeo } from '@/store/geo';
import { useSettings } from '@/store/settings';
import { useWeekView } from '@/store/weekView';
import { emptyEntry } from '@/timecard/types';

import WeekScreen from '../(tabs)/index';
import SettingsScreen from '../(tabs)/settings';
import TabsLayout from '../(tabs)/_layout';

const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': WeekScreen,
  '(tabs)/settings': SettingsScreen,
};
const location = jest.requireMock('expo-location') as {
  __state: { access: string; askAnswer: string; position: object; geofences: unknown[] | null };
};
const flush = () => act(async () => {});
const press = (name: string | RegExp) =>
  act(async () => fireEvent.press(screen.getByRole('button', { name })));

// Made-up places, times and coordinates only (CLAUDE.md §7).
const at = (h: number, m = 0) => new Date(2030, 0, 9, h, m).getTime();

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2030, 0, 9, 12, 45) });
  jest.replaceProperty(Platform, 'OS', 'android');
  useSettings.getState().replaceAll({ holidays: [] });
  useEntries.setState({ entries: {} });
  useGeo.getState().set(EMPTY_GEO_STATE);
  useGeo.getState().setRegisteredKey(null);
  useWeekView.getState().setMonday('2030-01-07');
  Object.assign(location.__state, {
    access: 'undetermined',
    askAnswer: 'always',
    position: { latitude: 40.1, longitude: -75.2 },
    geofences: null,
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('arrive and leave: Week screen', () => {
  it('shows waiting questions and answering logs them', async () => {
    useEntries.setState({
      entries: { '2030-01-09': { ...emptyEntry('2030-01-09'), start: '08:00' } },
    });
    useGeo.getState().set({
      inside: {},
      pendingExit: null,
      prompts: [
        {
          id: 'travel-1',
          kind: 'travel',
          date: '2030-01-09',
          fromPlace: 'Main office',
          toPlace: 'Client site',
          from: at(9, 10),
          to: at(9, 35),
          clockedOut: false,
        },
      ],
    });
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('At Client site')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Drive from Main office, 9:10 AM – 9:35 AM (25 min). Log the drive as time worked?',
      ),
    ).toBeOnTheScreen();
    await press('Count as worked');
    expect(useEntries.getState().entries['2030-01-09'].travel).toBe('Yes');
    expect(screen.queryByText('At Client site')).toBeNull();
  });

  it('asks to clock out after 5 minutes away', async () => {
    useEntries.setState({
      entries: { '2030-01-09': { ...emptyEntry('2030-01-09'), start: '08:00' } },
    });
    useGeo.getState().set({
      inside: {},
      pendingExit: { place: 'Main office', at: at(12, 30), date: '2030-01-09' },
      prompts: [],
    });
    await renderRouter(routes, { initialUrl: '/' });
    expect(
      await screen.findByText('You left at 12:30 PM. Clock out at 12:30 PM?'),
    ).toBeOnTheScreen();
    await press('Clock out');
    expect(useEntries.getState().entries['2030-01-09'].end).toBe('12:30');
  });
});

describe('arrive and leave: Settings', () => {
  it('turns on with location access, and saves a circle for a place', async () => {
    await renderRouter(routes, { initialUrl: '/settings' });
    await screen.findByRole('header', { name: 'Arrive and leave' });
    await act(async () =>
      fireEvent(screen.getByLabelText('Ask when I arrive and leave'), 'valueChange', true),
    );
    await flush();
    expect(useSettings.getState().geofencing).toBe(true);

    await press('Set Main office to where I am now');
    await flush();
    expect(useSettings.getState().places).toEqual([
      { location: 'Main office', latitude: 40.1, longitude: -75.2, radiusMeters: 150 },
    ]);
    expect(screen.getByText('✓ Set · 150 m circle')).toBeOnTheScreen();
    // Registered with the phone.
    expect(location.__state.geofences).toEqual([
      {
        identifier: 'Main office',
        latitude: 40.1,
        longitude: -75.2,
        radius: 150,
        notifyOnEnter: true,
        notifyOnExit: true,
      },
    ]);

    await act(async () => fireEvent.press(screen.getByRole('radio', { name: '250 m' })));
    await flush();
    expect(useSettings.getState().places[0].radiusMeters).toBe(250);

    await act(async () =>
      fireEvent(screen.getByLabelText('Ask when I arrive and leave'), 'valueChange', false),
    );
    await flush();
    expect(location.__state.geofences).toBeNull();
  });

  it('outlines a big place from pasted Google Maps points', async () => {
    useSettings.getState().update({ geofencing: true });
    await renderRouter(routes, { initialUrl: '/settings' });
    await screen.findByRole('header', { name: 'Arrive and leave' });
    await press("Draw Main office's outline from map points");
    await act(async () =>
      fireEvent.changeText(
        screen.getByLabelText('Paste corners for Main office'),
        '40.1, -75.2\n40.104, -75.2\n40.104, -75.196\n40.1, -75.196',
      ),
    );
    await press('Add pasted corners to Main office');
    await flush();
    const [place] = useSettings.getState().places;
    expect(place.outline).toHaveLength(4);
    // The circle Android watches covers the whole outline.
    expect(place.latitude).toBeCloseTo(40.102, 4);
    expect(place.radiusMeters).toBeGreaterThan(300);
    expect(screen.getByText(/✓ Outline · 4 corners/)).toBeOnTheScreen();
    expect(location.__state.geofences).toMatchObject([
      { identifier: 'Main office', radius: place.radiusMeters },
    ]);

    // Standing in the middle.
    location.__state.position = { latitude: 40.102, longitude: -75.198 };
    await press('Check where I am');
    await flush();
    expect(screen.getByText('Main office: inside the outline.')).toBeOnTheScreen();

    await press("Remove Main office's last corner");
    expect(useSettings.getState().places[0].outline).toHaveLength(3);
    await press("Clear Main office's outline");
    expect(useSettings.getState().places).toEqual([]);
  });

  it('adds a new place and deletes one, from the places list', async () => {
    useSettings.getState().update({
      geofencing: true,
      locations: ['Main office', 'Vendor'],
      places: [{ location: 'Vendor', latitude: 40.1, longitude: -75.2, radiusMeters: 150 }],
    });
    await renderRouter(routes, { initialUrl: '/settings' });
    await screen.findByRole('header', { name: 'Arrive and leave' });
    await act(async () => fireEvent.changeText(screen.getByLabelText('New place'), 'Warehouse'));
    await press('Add place');
    expect(useSettings.getState().locations).toEqual(['Main office', 'Vendor', 'Warehouse']);
    expect(
      screen.getByRole('button', { name: 'Set Warehouse to where I am now' }),
    ).toBeOnTheScreen();

    await press('Delete Vendor');
    await press('Yes, delete Vendor');
    expect(useSettings.getState().locations).toEqual(['Main office', 'Warehouse']);
    expect(useSettings.getState().places).toEqual([]);
  });

  it('says what to do with "while using" location access only', async () => {
    location.__state.askAnswer = 'whileUsing';
    await renderRouter(routes, { initialUrl: '/settings' });
    await screen.findByRole('header', { name: 'Arrive and leave' });
    await act(async () =>
      fireEvent(screen.getByLabelText('Ask when I arrive and leave'), 'valueChange', true),
    );
    await flush();
    expect(screen.getByText(/Choose “Allow all the time”/)).toBeOnTheScreen();
  });

  it('is explained as Android-only on the web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    await renderRouter(routes, { initialUrl: '/settings' });
    await screen.findByRole('header', { name: 'Arrive and leave' });
    expect(screen.getByText(/isn't available on the web/)).toBeOnTheScreen();
  });
});
