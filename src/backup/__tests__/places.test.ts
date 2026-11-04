import type { GeoPlace } from '@/geofence/engine';

import { parseBackup } from '../format';
import {
  buildPlacesFile,
  mergePlaces,
  parsePlaces,
  placesFileName,
  planImport,
  sharablePlaces,
} from '../places';

// Made-up places and coordinates only (CLAUDE.md §7).
const office: GeoPlace = {
  location: 'Main office',
  latitude: 40.1,
  longitude: -75.2,
  radiusMeters: 150,
};
const yard: GeoPlace = {
  location: 'Yard',
  latitude: 40.2,
  longitude: -75.3,
  radiusMeters: 240,
  outline: [
    { latitude: 40.201, longitude: -75.301 },
    { latitude: 40.199, longitude: -75.301 },
    { latitude: 40.2, longitude: -75.298 },
  ],
};
const now = new Date(2030, 0, 9, 12);

describe('sharing places', () => {
  it('shares only places that are set and still listed, in list order', () => {
    const gone = { ...office, location: 'Old site' };
    expect(sharablePlaces([yard, office, gone], ['Main office', 'Vendor', 'Yard'])).toEqual([
      office,
      yard,
    ]);
    expect(placesFileName(now)).toBe('punchd-places-2030-01-09.json');
  });

  it('reads back what it wrote, outlines included', () => {
    const text = JSON.stringify(buildPlacesFile([office, yard], now));
    expect(parsePlaces(text)).toEqual({ ok: true, places: [office, yard] });
  });

  it('turns away other files and leaves out unreadable places', () => {
    expect(parsePlaces('not json').ok).toBe(false);
    expect(parsePlaces(JSON.stringify({ format: 'clocked-backup', version: 1 }))).toMatchObject({
      ok: false,
      message: expect.stringContaining('backup, not a places file'),
    });
    expect(
      parsePlaces(JSON.stringify({ ...buildPlacesFile([office], now), version: 99 })),
    ).toMatchObject({ ok: false, message: expect.stringContaining('newer version') });
    const file = buildPlacesFile([office], now);
    const messy = {
      ...file,
      places: [
        { location: '  Yard ', latitude: 40.2, longitude: -75.3, radiusMeters: 240 },
        { location: 'yard', latitude: 1, longitude: 1, radiusMeters: 240 },
        { location: 'Nowhere', latitude: 999, longitude: 0, radiusMeters: 150 },
      ],
    };
    expect(parsePlaces(JSON.stringify(messy))).toEqual({
      ok: true,
      places: [{ location: 'Yard', latitude: 40.2, longitude: -75.3, radiusMeters: 240 }],
    });
    expect(parsePlaces(JSON.stringify({ ...file, places: [] })).ok).toBe(false);
  });

  it('Restore points a places file to Import places', () => {
    expect(parseBackup(JSON.stringify(buildPlacesFile([office], now)))).toMatchObject({
      ok: false,
      message: expect.stringContaining('Import places'),
    });
  });
});

describe('importing places', () => {
  const mine = {
    locations: ['Main office', 'Remote', 'Yard'],
    places: [{ ...office, radiusMeters: 250 }],
  };
  const theirs = [office, { ...yard, location: 'yard' }, { ...office, location: 'Depot' }];

  it('says what is new, the same, or set differently here', () => {
    expect(planImport(mine, theirs)).toEqual({
      fresh: ['Yard', 'Depot'],
      differ: ['Main office'],
      same: [],
    });
    expect(planImport({ locations: ['Main office'], places: [office] }, [office])).toEqual({
      fresh: [],
      differ: [],
      same: ['Main office'],
    });
  });

  it("adds new places under this phone's names and keeps mine unless told", () => {
    const kept = mergePlaces(mine, theirs, false);
    expect(kept.locations).toEqual(['Main office', 'Remote', 'Yard', 'Depot']);
    expect(kept.places).toEqual([
      { ...office, radiusMeters: 250 },
      yard,
      { ...office, location: 'Depot' },
    ]);
    const replaced = mergePlaces(mine, theirs, true);
    expect(replaced.places.find((p) => p.location === 'Main office')).toEqual(office);
  });
});
