/**
 * Outlines for big places (owner request, 3 Nov 2026): a work site traced
 * as corners, e.g. pins dropped in Google Maps and copied, instead of one
 * circle around where the phone was standing.
 *
 * Android only watches circles, so an outline becomes the smallest circle
 * that covers every corner, plus a little room for GPS. Pure functions.
 */

export type LatLng = { latitude: number; longitude: number };

export const MAX_CORNERS = 40;
/** Room around the outline for GPS wobble. */
export const OUTLINE_MARGIN_M = 30;
/** Android misses arrivals at smaller circles. */
export const MIN_OUTLINE_RADIUS_M = 100;
/** Bigger than this isn't one place. */
export const MAX_OUTLINE_RADIUS_M = 5000;

const EARTH_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Metres between two points. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const valid = (lat: number, lon: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180 &&
  !(lat === 0 && lon === 0);

const same = (a: LatLng, b: LatLng) =>
  Math.abs(a.latitude - b.latitude) < 1e-7 && Math.abs(a.longitude - b.longitude) < 1e-7;

/**
 * Corners from pasted text: Google Maps' "40.71234, -74.00123" (one or
 * many, any separators), a Google Maps link with "@40.71234,-74.00123", or
 * the <coordinates> of a KML file from Google My Maps (longitude first).
 * Repeats, and the KML's closing corner, are dropped.
 */
export function parseCorners(text: string): LatLng[] {
  const out: LatLng[] = [];
  const add = (lat: number, lon: number) => {
    if (!valid(lat, lon)) return;
    const p = { latitude: lat, longitude: lon };
    if (!out.some((q) => same(p, q))) out.push(p);
  };
  const kml = text.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
  if (kml) {
    for (const tuple of kml[1].trim().split(/\s+/)) {
      const [lon, lat] = tuple.split(',').map(Number);
      add(lat, lon);
    }
    return out;
  }
  // Both numbers need decimals, so things like "100, 150" aren't read as places.
  const pair = /(-?\d{1,3}\.\d+)°?\s*[,\s]\s*(-?\d{1,3}\.\d+)°?/g;
  for (const m of text.matchAll(pair)) add(Number(m[1]), Number(m[2]));
  return out;
}

type XY = { x: number; y: number };
type Disc = { c: XY; r: number };

/** Flat metres around `origin` (fine for anything the size of a work site). */
function toXY(p: LatLng, origin: LatLng): XY {
  return {
    x: rad(p.longitude - origin.longitude) * EARTH_M * Math.cos(rad(origin.latitude)),
    y: rad(p.latitude - origin.latitude) * EARTH_M,
  };
}

function fromXY(p: XY, origin: LatLng): LatLng {
  return {
    latitude: origin.latitude + (p.y / EARTH_M) * (180 / Math.PI),
    longitude:
      origin.longitude + (p.x / (EARTH_M * Math.cos(rad(origin.latitude)))) * (180 / Math.PI),
  };
}

const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);
const covers = (d: Disc, p: XY) => dist(d.c, p) <= d.r + 1e-6;
const two = (a: XY, b: XY): Disc => ({
  c: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  r: dist(a, b) / 2,
});

function three(a: XY, b: XY, c: XY): Disc {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) {
    // In a line: the two furthest apart.
    const pairs = [two(a, b), two(a, c), two(b, c)];
    return pairs.reduce((m, p) => (p.r > m.r ? p : m));
  }
  const sq = (p: XY) => p.x * p.x + p.y * p.y;
  const c0 = {
    x: (sq(a) * (b.y - c.y) + sq(b) * (c.y - a.y) + sq(c) * (a.y - b.y)) / d,
    y: (sq(a) * (c.x - b.x) + sq(b) * (a.x - c.x) + sq(c) * (b.x - a.x)) / d,
  };
  return { c: c0, r: dist(c0, a) };
}

/** The smallest circle around the points (Welzl's method, a handful of points). */
function smallestDisc(ps: XY[]): Disc {
  let d: Disc = { c: ps[0], r: 0 };
  for (let i = 1; i < ps.length; i++) {
    if (covers(d, ps[i])) continue;
    d = { c: ps[i], r: 0 };
    for (let j = 0; j < i; j++) {
      if (covers(d, ps[j])) continue;
      d = two(ps[i], ps[j]);
      for (let k = 0; k < j; k++) if (!covers(d, ps[k])) d = three(ps[i], ps[j], ps[k]);
    }
  }
  return d;
}

/** The circle Android watches for an outline: covers every corner, plus a margin. */
export function circleForOutline(outline: LatLng[]): LatLng & { radiusMeters: number } {
  const origin = outline[0];
  const disc = smallestDisc(outline.map((p) => toXY(p, origin)));
  const centre = fromXY(disc.c, origin);
  const radius = Math.ceil((disc.r + OUTLINE_MARGIN_M) / 10) * 10;
  return {
    latitude: Number(centre.latitude.toFixed(7)),
    longitude: Number(centre.longitude.toFixed(7)),
    radiusMeters: Math.max(MIN_OUTLINE_RADIUS_M, radius),
  };
}

/** Is the point inside the outline (3 or more corners)? */
export function insideOutline(p: LatLng, outline: LatLng[]): boolean {
  if (outline.length < 3) return false;
  const pts = outline.map((q) => toXY(q, p));
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > 0 !== b.y > 0 && 0 < ((b.x - a.x) * (0 - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Flat points for drawing the outline (x right, y down), in metres from its top-left. */
export function outlineShape(outline: LatLng[], circle: LatLng & { radiusMeters: number }) {
  const pts = outline.map((p) => toXY(p, circle));
  const r = circle.radiusMeters;
  return {
    size: 2 * r,
    points: pts.map((p) => ({ x: p.x + r, y: r - p.y })),
  };
}
