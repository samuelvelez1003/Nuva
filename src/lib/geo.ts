/**
 * Geo helpers. The map uses a local Web Mercator projection — the same one the
 * basemap (Mapbox / MapLibre) draws with, so routes and markers sit exactly on its
 * streets — scaled so 1 unit = 10 metres at the middle of the country's area.
 * Inside one city the scale varies < 0.1 %, so map distances are real distances.
 */
import { es } from '../i18n/es';

export interface LatLng {
  lat: number;
  lng: number;
}
export interface Pt {
  x: number;
  y: number;
}

/**
 * Projection area of the active country (Pereira by default). Set once per
 * country by applyRegion(); the app remounts on country change, so every
 * projected point is recomputed against the new origin.
 */
export let BOUNDS = { minLat: 4.74, maxLat: 4.88, minLng: -75.82, maxLng: -75.6 };

const UNIT_M = 10;
const RAD = Math.PI / 180;
/** Web Mercator northing of a latitude, in "degrees" (equal to longitude degrees at the equator). */
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD;
const latOfMercY = (y: number) => (2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2) / RAD;

/** Map units per degree of longitude (= per Mercator degree) for the active area. */
let UNITS_PER_DEG = (111_320 * Math.cos(4.81 * RAD)) / UNIT_M;
export const unitsPerDegree = () => UNITS_PER_DEG;

export let MAP_W = Math.round((BOUNDS.maxLng - BOUNDS.minLng) * UNITS_PER_DEG);
export let MAP_H = Math.round((mercY(BOUNDS.maxLat) - mercY(BOUNDS.minLat)) * UNITS_PER_DEG);

/** Re-centres the projection on another country's area. */
export function setProjectionBounds(b: typeof BOUNDS) {
  BOUNDS = b;
  UNITS_PER_DEG = (111_320 * Math.cos(((b.minLat + b.maxLat) / 2) * RAD)) / UNIT_M;
  MAP_W = Math.round((b.maxLng - b.minLng) * UNITS_PER_DEG);
  MAP_H = Math.round((mercY(b.maxLat) - mercY(b.minLat)) * UNITS_PER_DEG);
}

export function project(p: LatLng): Pt {
  return {
    x: (p.lng - BOUNDS.minLng) * UNITS_PER_DEG,
    y: (mercY(BOUNDS.maxLat) - mercY(p.lat)) * UNITS_PER_DEG,
  };
}

export function unproject(p: Pt): LatLng {
  return {
    lng: BOUNDS.minLng + p.x / UNITS_PER_DEG,
    lat: latOfMercY(mercY(BOUNDS.maxLat) - p.y / UNITS_PER_DEG),
  };
}

/** Dictionary keys of the turn-by-turn instructions (`nav.*` in src/i18n). */
export type NavKey = 'nav.turnLeft' | 'nav.turnRight' | 'nav.straight' | 'nav.roundabout' | 'nav.arrive';

export interface NavStep {
  /** Translatable instruction: render with `t(step.key)`. */
  key: NavKey;
  /** Instruction already rendered (Spanish unless a `t` was passed). */
  text: string;
  street: string;
  dir: 'left' | 'right' | 'straight' | 'arrive';
  atFraction: number;
}

/** Spanish fallback used when no translator is passed. */
const spanish = (key: NavKey) => es[key];

/**
 * Turn-by-turn instructions derived from a route polyline (fallback when the
 * routing service didn't return named steps): only clear turns (> 35°).
 * Each step carries its `key`; pass `t` (from `useT()`) to also get `text`
 * in the current language.
 */
export function instructions(pts: Pt[], t: (key: NavKey) => string = spanish): NavStep[] {
  const total = pathLength(pts) || 1;
  const out: NavStep[] = [];
  let acc = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    acc += dist(pts[i - 1], pts[i]);
    const a = { x: pts[i].x - pts[i - 1].x, y: pts[i].y - pts[i - 1].y };
    const b = { x: pts[i + 1].x - pts[i].x, y: pts[i + 1].y - pts[i].y };
    const la = Math.hypot(a.x, a.y);
    const lb = Math.hypot(b.x, b.y);
    if (la < 1 || lb < 1) continue;
    const sin = (a.x * b.y - a.y * b.x) / (la * lb);
    if (Math.abs(sin) < 0.57) continue;
    const dir = sin > 0 ? 'right' : 'left';
    const key: NavKey = dir === 'right' ? 'nav.turnRight' : 'nav.turnLeft';
    out.push({ key, text: t(key), street: '', dir, atFraction: acc / total });
  }
  out.push({ key: 'nav.arrive', text: t('nav.arrive'), street: '', dir: 'arrive', atFraction: 1 });
  return out;
}

export const GRID = 22; // ≈ one street every 220 m

const snap = (v: number) => Math.round(v / GRID) * GRID;
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Builds a believable street-following route: hop onto the street grid,
 * travel along a carrera, cross along a calle, and drop off at the door.
 */
export function buildRoute(fromLL: LatLng, toLL: LatLng): Pt[] {
  const a = project(fromLL);
  const b = project(toLL);
  const ax = snap(a.x);
  const bx = snap(b.x);
  const midY = snap(a.y + (b.y - a.y) * 0.62);
  const raw: Pt[] = [a, { x: ax, y: a.y }, { x: ax, y: midY }, { x: bx, y: midY }, { x: bx, y: b.y }, b];
  // Drop zero-length segments.
  return raw.filter((p, i) => i === 0 || dist(p, raw[i - 1]) > 0.5);
}

export function pathLength(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

/** Point and heading (degrees, 0 = north) at fraction t ∈ [0,1] of a path. */
export function pointAlong(pts: Pt[], t: number): Pt & { heading: number } {
  if (pts.length < 2) return { ...(pts[0] ?? { x: 0, y: 0 }), heading: 0 };
  const total = pathLength(pts);
  let target = Math.min(1, Math.max(0, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    if (target <= seg || i === pts.length - 1) {
      const k = seg === 0 ? 0 : Math.min(1, target / seg);
      const p = pts[i - 1];
      const q = pts[i];
      const heading = (Math.atan2(q.x - p.x, -(q.y - p.y)) * 180) / Math.PI;
      return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, heading };
    }
    target -= seg;
  }
  const last = pts[pts.length - 1];
  return { ...last, heading: 0 };
}

/** Sub-path from fraction t to the end — the part of the route still ahead. */
export function remainingPath(pts: Pt[], t: number): Pt[] {
  if (t <= 0) return pts;
  const total = pathLength(pts);
  let target = Math.min(1, t) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    if (target <= seg) {
      const k = seg === 0 ? 0 : target / seg;
      const p = pts[i - 1];
      const q = pts[i];
      return [{ x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k }, ...pts.slice(i)];
    }
    target -= seg;
  }
  return [pts[pts.length - 1]];
}

/** SVG path with softly rounded corners. */
export function roundedPath(pts: Pt[], r = 10): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const n = pts[i + 1];
    const r1 = Math.min(r, dist(p, c) / 2);
    const r2 = Math.min(r, dist(c, n) / 2);
    const a = { x: c.x + ((p.x - c.x) / (dist(p, c) || 1)) * r1, y: c.y + ((p.y - c.y) / (dist(p, c) || 1)) * r1 };
    const b = { x: c.x + ((n.x - c.x) / (dist(c, n) || 1)) * r2, y: c.y + ((n.y - c.y) / (dist(c, n) || 1)) * r2 };
    d += ` L${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

export type Traffic = 'fluido' | 'moderado' | 'pesado';

// Typical average speeds in Pereira / Dosquebradas.
const SPEED_KMH: Record<Traffic, number> = { fluido: 32, moderado: 26, pesado: 19 };

/** Multiplier applied to free-flow routing durations (OSRM has no traffic). */
export const TRAFFIC_FACTOR: Record<Traffic, number> = { fluido: 1.15, moderado: 1.35, pesado: 1.7 };

export function trafficNow(d = new Date()): Traffic {
  const h = d.getHours();
  if ((h >= 6 && h < 9) || (h >= 17 && h < 20)) return 'pesado';
  if (h >= 22 || h < 5) return 'fluido';
  return 'moderado';
}

/** Distance (km, 1 decimal) and duration (whole minutes) for a route. */
export function routeMetrics(pts: Pt[], traffic: Traffic = 'moderado') {
  const km = Math.max(0.4, (pathLength(pts) * UNIT_M * 1.06) / 1000);
  const distanceKm = Math.round(km * 10) / 10;
  const durationMin = Math.max(3, Math.round((distanceKm / SPEED_KMH[traffic]) * 60 + 1.5));
  return { distanceKm, durationMin };
}

export function bbox(pts: Pt[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
}

/** Offsets a lat/lng by metres — used to place mock drivers around a pickup. */
export function offset(p: LatLng, dxM: number, dyM: number): LatLng {
  return { lat: p.lat - dyM / 110_574, lng: p.lng + dxM / (111_320 * Math.cos(p.lat * RAD)) };
}
