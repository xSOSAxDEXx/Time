import {
  circleForOutline,
  distanceMeters,
  insideOutline,
  MIN_OUTLINE_RADIUS_M,
  OUTLINE_MARGIN_M,
  parseCorners,
} from '../outline';

// Made-up points, not anyone's real places (CLAUDE.md §7).
const at = (latitude: number, longitude: number) => ({ latitude, longitude });
// About 111 m per 0.001° of latitude.
const square = [at(10, 20), at(10.004, 20), at(10.004, 20.004), at(10, 20.004)];

describe('reading pasted corners', () => {
  it('reads Google Maps points, one or many, and skips repeats', () => {
    expect(parseCorners('10.12345, 20.54321')).toEqual([at(10.12345, 20.54321)]);
    expect(parseCorners('10.1, -20.2\n10.3,-20.4  (-10.5, 20.6) 10.1, -20.2')).toEqual([
      at(10.1, -20.2),
      at(10.3, -20.4),
      at(-10.5, 20.6),
    ]);
  });

  it('reads a Google Maps link', () => {
    expect(parseCorners('https://www.google.com/maps/@10.12345,-20.54321,17z')).toEqual([
      at(10.12345, -20.54321),
    ]);
  });

  it("reads a KML file's corners (longitude first) without the closing repeat", () => {
    const kml = `<Polygon><outerBoundaryIs><LinearRing><coordinates>
      20.1,10.1,0 20.2,10.1,0 20.2,10.2,0 20.1,10.1,0
    </coordinates></LinearRing></outerBoundaryIs></Polygon>`;
    expect(parseCorners(kml)).toEqual([at(10.1, 20.1), at(10.1, 20.2), at(10.2, 20.2)]);
  });

  it('ignores whole numbers and impossible points', () => {
    expect(parseCorners('100, 150 and 95.1, 20.1 and 10.1, 200.5 and hello')).toEqual([]);
  });
});

describe('the circle around an outline', () => {
  it('covers every corner, with a margin', () => {
    const c = circleForOutline(square);
    for (const p of square) {
      expect(distanceMeters(c, p)).toBeLessThanOrEqual(c.radiusMeters - OUTLINE_MARGIN_M + 1);
    }
    // Half the square's diagonal (~312 m) plus the margin, rounded up to 10 m.
    expect(c.radiusMeters).toBeGreaterThanOrEqual(330);
    expect(c.radiusMeters).toBeLessThanOrEqual(350);
    expect(c.latitude).toBeCloseTo(10.002, 4);
    expect(c.longitude).toBeCloseTo(20.002, 4);
  });

  it('is never smaller than Android can notice', () => {
    expect(circleForOutline([at(10, 20)]).radiusMeters).toBe(MIN_OUTLINE_RADIUS_M);
  });

  it('a long, thin site gets a circle as wide as it is long', () => {
    const strip = [at(10, 20), at(10.01, 20), at(10.01, 20.0002), at(10, 20.0002)];
    const c = circleForOutline(strip);
    expect(c.radiusMeters).toBeGreaterThan(556 + OUTLINE_MARGIN_M - 1);
  });
});

describe('inside an outline', () => {
  it('tells inside from outside', () => {
    expect(insideOutline(at(10.002, 20.002), square)).toBe(true);
    expect(insideOutline(at(10.005, 20.002), square)).toBe(false);
    // An L shape: the missing corner is outside.
    const l = [
      at(10, 20),
      at(10.004, 20),
      at(10.004, 20.002),
      at(10.002, 20.002),
      at(10.002, 20.004),
      at(10, 20.004),
    ];
    expect(insideOutline(at(10.003, 20.003), l)).toBe(false);
    expect(insideOutline(at(10.001, 20.003), l)).toBe(true);
  });
});
