import { es } from '../i18n/es';
import { buildRoute, LatLng, NavKey, NavStep, project, Pt, routeMetrics, TRAFFIC_FACTOR, trafficNow } from './geo';

/**
 * Street routing. Every route shown or priced comes from real streets:
 *  - Mapbox Directions `driving-traffic` (EXPO_PUBLIC_MAPBOX_TOKEN): live traffic. The source
 *    for everything (quote, request, driver navigation, live trips, admin, web).
 *  - OSRM public server (OpenStreetMap): last resort only when Mapbox can't be reached;
 *    still real streets, free-flow time scaled by Pereira's traffic hours.
 *  - `estimateRoute`: a placeholder (two points) with grid metrics. It is never drawn
 *    (CityMap shows markers only) and never sent to the server as a price.
 * Both services answer in the same (OSRM) format.
 */
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const MAPBOX = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic';
const OSRM = 'https://router.project-osrm.org/route/v1/driving';

/** True when the build carries a Mapbox token (routes with live traffic). */
export const TRAFFIC_ROUTING = MAPBOX_TOKEN.startsWith('pk.');

export interface RouteResult {
  points: Pt[];
  distanceKm: number;
  durationMin: number;
  steps?: NavStep[];
  /** `street`: follows real streets (Mapbox or OSRM); `estimate`: placeholder, never drawn. */
  source: 'street' | 'estimate';
  /** Who answered: Mapbox (live traffic), OSRM (traffic hours) or nobody (estimate). */
  provider: 'mapbox' | 'osrm' | 'none';
  /** When it was computed (ms), so live trips know how fresh the ETA is. */
  at: number;
}

/** How often a live trip asks for a fresh route/ETA with traffic. */
export const ROUTE_REFRESH_MS = 75_000;

/**
 * A route that must not be drawn: the two-point placeholder (or nothing). Street
 * routes always have 3+ points (see `streetRoute`).
 */
export const isPlaceholderRoute = (points: Pt[] | null | undefined) => !points || points.length <= 2;

// Traffic changes: Mapbox answers are reused for 90 s, an OSRM fallback for 30 s
// (so Mapbox is asked again soon).
const TTL = { mapbox: 90_000, osrm: 30_000, none: 0 } as const;
const cache = new Map<string, RouteResult>();
const inflight = new Map<string, Promise<RouteResult | null>>();

const DIR: Record<string, NavStep['dir']> = {
  left: 'left',
  'slight left': 'left',
  'sharp left': 'left',
  right: 'right',
  'slight right': 'right',
  'sharp right': 'right',
  straight: 'straight',
  uturn: 'left',
};

/** Dictionary key (`nav.*`) of a maneuver. */
function stepKey(type: string, modifier: string | undefined): NavKey {
  if (type === 'arrive') return 'nav.arrive';
  if (type === 'roundabout' || type === 'rotary') return 'nav.roundabout';
  if (modifier?.includes('left')) return 'nav.turnLeft';
  if (modifier?.includes('right')) return 'nav.turnRight';
  return 'nav.straight';
}

/**
 * Instruction text of a maneuver. Routes are cached and shared, so steps
 * keep the Spanish `text` plus their `key`: screens render `t(step.key)`.
 */
function stepText(type: string, modifier: string | undefined, t: (key: NavKey) => string = (k) => es[k]) {
  return t(stepKey(type, modifier));
}

/**
 * Placeholder while the street route loads (or if every service failed): grid
 * metrics for a rough idea, two points so nothing is drawn. Never a price.
 */
export function estimateRoute(from: LatLng, to: LatLng): RouteResult {
  const metrics = routeMetrics(buildRoute(from, to), trafficNow());
  return { points: [project(from), project(to)], ...metrics, source: 'estimate', provider: 'none', at: Date.now() };
}

/** One routing service; null when it fails, so the next one is tried. */
async function streetRoute(base: string, from: LatLng, to: LatLng, query: string, liveTraffic: boolean, timeoutMs: number): Promise<RouteResult | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true&alternatives=false${query}`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.routes?.[0];
    if (!r || !Array.isArray(r.geometry?.coordinates) || r.geometry.coordinates.length < 2) return null;
    const coords = r.geometry.coordinates as [number, number][];
    // A street route always has 3+ points (a straight block gets its midpoint), so it
    // can never be mistaken for the two-point placeholder.
    if (coords.length === 2) coords.splice(1, 0, [(coords[0][0] + coords[1][0]) / 2, (coords[0][1] + coords[1][1]) / 2]);
    const points: Pt[] = coords.map(([lng, lat]) => project({ lat, lng }));
    const total = r.distance || 1;
    let acc = 0;
    const steps: NavStep[] = [];
    for (const s of r.legs?.[0]?.steps ?? []) {
      const type: string = s.maneuver?.type ?? '';
      if (type !== 'depart' && type !== 'continue' && type !== 'new name') {
        steps.push({ key: stepKey(type, s.maneuver?.modifier), text: stepText(type, s.maneuver?.modifier), street: s.name ?? '', dir: type === 'arrive' ? 'arrive' : DIR[s.maneuver?.modifier] ?? 'straight', atFraction: Math.min(1, acc / total) });
      }
      acc += s.distance ?? 0;
    }
    const distanceKm = Math.round((r.distance / 1000) * 10) / 10;
    // Mapbox already counts live traffic; OSRM is free-flow, so scale it by Pereira's traffic hours.
    const durationMin = Math.max(2, Math.round((r.duration / 60) * (liveTraffic ? 1 : TRAFFIC_FACTOR[trafficNow()])));
    return { points, distanceKm: Math.max(0.4, distanceKm), durationMin, steps, source: 'street', provider: liveTraffic ? 'mapbox' : 'osrm', at: Date.now() };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function resolveStreet(from: LatLng, to: LatLng): Promise<RouteResult | null> {
  if (TRAFFIC_ROUTING) {
    // Mapbox with live traffic first, asked twice (a slow phone network often recovers).
    const q = `&access_token=${MAPBOX_TOKEN}`;
    const first = await streetRoute(MAPBOX, from, to, q, true, 8000);
    if (first) return first;
    await wait(700);
    const second = await streetRoute(MAPBOX, from, to, q, true, 8000);
    if (second) return second;
  }
  // Last resort: real streets without live traffic (scaled by traffic hours).
  return streetRoute(OSRM, from, to, '', false, 7000);
}

/**
 * Street route (Mapbox with traffic; OSRM only if Mapbox is unreachable), or null
 * when every service failed — callers then show "no se pudo calcular la ruta" and
 * retry, never a straight line. `fresh` skips the cache (live ETA refresh).
 */
export async function fetchStreetRoute(from: LatLng, to: LatLng, o?: { fresh?: boolean }): Promise<RouteResult | null> {
  const key = [from.lat, from.lng, to.lat, to.lng].map((n) => n.toFixed(5)).join(',');
  const hit = cache.get(key);
  if (hit && !o?.fresh && Date.now() - hit.at < TTL[hit.provider]) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;
  const job = resolveStreet(from, to)
    .then((out) => {
      if (out) cache.set(key, out);
      return out;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

/** Street route, or the (undrawn) placeholder when every service failed. */
export async function fetchRoute(from: LatLng, to: LatLng, o?: { fresh?: boolean }): Promise<RouteResult> {
  return (await fetchStreetRoute(from, to, o)) ?? estimateRoute(from, to);
}
