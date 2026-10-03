import { Platform } from 'react-native';
import type { Place } from '../data/places';
import type { LatLng } from './geo';

/**
 * Address search with OpenStreetMap data, limited to the active country's area
 * (Pereira / Dosquebradas or Curaçao):
 *  - Photon (komoot): built for search-as-you-type, ranks near the passenger.
 *  - Nominatim: backup, and reverse geocoding (≤ 1 req/s; callers debounce).
 * No keys, no accounts. Results are cached per query.
 */
const PHOTON = 'https://photon.komoot.io';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
// Photon bbox: minLon,minLat,maxLon,maxLat. Nominatim viewbox: left,top,right,bottom.
let BBOX = '-75.86,4.72,-75.58,4.90';
let VIEWBOX = '-75.86,4.90,-75.58,4.72';
let COUNTRY_CODE = 'co';
let CENTER = { lat: 4.81333, lng: -75.69611 };

/** Search area of the active country (called by applyRegion). */
export function setSearchArea(b: { minLat: number; maxLat: number; minLng: number; maxLng: number }, countryCode: string, center: LatLng) {
  BBOX = `${b.minLng},${b.minLat},${b.maxLng},${b.maxLat}`;
  VIEWBOX = `${b.minLng},${b.maxLat},${b.maxLng},${b.minLat}`;
  COUNTRY_CODE = countryCode;
  CENTER = center;
  cache.clear();
}
const HEADERS: Record<string, string> = Platform.OS === 'web' ? { 'Accept-Language': 'es' } : { 'Accept-Language': 'es', 'User-Agent': 'NUVA-movilidad/1.0 (nuva.expo.app)' };

/** A search result (kept as its own type so screens can show an optional distance). */
export interface SearchHit extends Place {
  distanceMeters?: number | null;
}

const cache = new Map<string, SearchHit[]>();

// ─── Photon ────────────────────────────────────────────────────────────────

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id: number;
    osm_type: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
  };
}

function fromPhoton(f: PhotonFeature): SearchHit {
  const p = f.properties;
  const road = p.street ? `${p.street}${p.housenumber ? ` #${p.housenumber}` : ''}` : '';
  const area = p.district || p.locality || (p.city?.startsWith('AMCO') ? '' : p.city) || '';
  const [lng, lat] = f.geometry.coordinates;
  return {
    id: `ph-${p.osm_type}${p.osm_id}`,
    kind: 'poi',
    name: p.name || road || area || 'Lugar',
    address: road || area,
    area,
    lat,
    lng,
  };
}

async function searchPhoton(q: string, near: LatLng): Promise<SearchHit[] | null> {
  try {
    const url = `${PHOTON}/api/?q=${encodeURIComponent(q)}&lat=${near.lat}&lon=${near.lng}&bbox=${BBOX}&limit=8`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: PhotonFeature[] };
    return (json.features ?? []).map(fromPhoton);
  } catch {
    return null;
  }
}

// ─── Nominatim ─────────────────────────────────────────────────────────────

interface NominatimItem {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
}

function fromNominatim(it: NominatimItem): SearchHit {
  const a = it.address ?? {};
  const road = a.road ? `${a.road}${a.house_number ? ` #${a.house_number}` : ''}` : '';
  const name = it.name || road || it.display_name.split(',')[0];
  const area = a.suburb || a.neighbourhood || a.city_district || a.city || a.town || a.village || '';
  return {
    id: `osm-${it.place_id}`,
    kind: 'poi',
    name,
    address: road || it.display_name.split(',').slice(0, 2).join(','),
    area,
    lat: Number(it.lat),
    lng: Number(it.lon),
  };
}

async function searchNominatim(q: string): Promise<SearchHit[]> {
  try {
    const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=${COUNTRY_CODE}&viewbox=${VIEWBOX}&bounded=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: HEADERS });
    return ((await res.json()) as NominatimItem[]).map(fromNominatim);
  } catch {
    return [];
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/** Drops repeats: same name within ~150 m (OSM often has a node and a building). */
function dedupe(list: SearchHit[]) {
  const out: SearchHit[] = [];
  for (const h of list) {
    const dup = out.some((o) => o.name.toLowerCase() === h.name.toLowerCase() && Math.abs(o.lat - h.lat) < 0.0014 && Math.abs(o.lng - h.lng) < 0.0014);
    if (!dup) out.push(h);
  }
  return out;
}

/** Places and addresses in Pereira / Dosquebradas, nearest to the passenger first. */
export async function searchPlaces(query: string, near: LatLng = CENTER): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const photon = await searchPhoton(q, near);
  const out = dedupe(photon && photon.length ? photon : await searchNominatim(q));
  cache.set(key, out);
  return out;
}

/** Coordinates for a hit (OpenStreetMap results already carry them). */
export async function resolveHit(hit: SearchHit): Promise<Place | null> {
  return Number.isFinite(hit.lat) && Number.isFinite(hit.lng) ? hit : null;
}

export async function reverseGeocode(p: LatLng): Promise<{ address: string; area: string } | null> {
  try {
    const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${p.lat}&lon=${p.lng}`, { headers: HEADERS });
    const it = (await res.json()) as NominatimItem;
    if (!it?.display_name) return null;
    const pl = fromNominatim(it);
    return { address: pl.address, area: pl.area };
  } catch {
    return null;
  }
}
