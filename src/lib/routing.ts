import { es } from '../i18n/es';
import { buildRoute, LatLng, NavKey, NavStep, project, Pt, routeMetrics, TRAFFIC_FACTOR, trafficNow } from './geo';

/**
 * Street routing, best first:
 *  - Mapbox Directions `driving-traffic` (with EXPO_PUBLIC_MAPBOX_TOKEN): live traffic.
 *  - OSRM public demo server (OpenStreetMap): free-flow, scaled by Pereira's traffic hours.
 *  - Local estimate, so the app never blocks on routing.
 * Both services answer in the same (OSRM) format.
 */
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const MAPBOX = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic';
const OSRM = 'https://router.project-osrm.org/route/v1/driving';

export interface RouteResult {
  points: Pt[];
  distanceKm: number;
  durationMin: number;
  steps?: NavStep[];
  /** `street`: follows real streets (Mapbox or OSRM); `estimate`: straight-line placeholder. */
  source: 'street' | 'estimate';
}

const cache = new Map<string, RouteResult>();

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
 * Instant estimate while the street route loads (or if routing fails). Metrics
 * come from the grid path (closer to real city distance), but it's drawn as a
 * straight line — a fake "L" over a real street map looks wrong.
 */
export function estimateRoute(from: LatLng, to: LatLng): RouteResult {
  const metrics = routeMetrics(buildRoute(from, to), trafficNow());
  return { points: [project(from), project(to)], ...metrics, source: 'estimate' };
}

/** One routing service; null when it fails, so the next one is tried. */
async function streetRoute(base: string, from: LatLng, to: LatLng, query: string, liveTraffic: boolean): Promise<RouteResult | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`${base}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true${query}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.routes?.[0];
    if (!r) return null;
    const points: Pt[] = (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => project({ lat, lng }));
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
    return { points, distanceKm: Math.max(0.4, distanceKm), durationMin, steps, source: 'street' };
  } catch {
    return null;
  }
}

export async function fetchRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  const key = [from.lat, from.lng, to.lat, to.lng].map((n) => n.toFixed(5)).join(',');
  const hit = cache.get(key);
  if (hit) return hit;
  const out =
    (MAPBOX_TOKEN.startsWith('pk.') ? await streetRoute(MAPBOX, from, to, `&access_token=${MAPBOX_TOKEN}`, true) : null) ??
    (await streetRoute(OSRM, from, to, '', false));
  if (!out) return estimateRoute(from, to);
  cache.set(key, out);
  return out;
}
