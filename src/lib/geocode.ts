import { Platform } from 'react-native';
import type { Place } from '../data/places';
import type { LatLng } from './geo';
import { supabase } from './supabase';

/**
 * Address search limited to the active country's area (Pereira / Dosquebradas or Curaçao):
 *  - HERE (through our `address-search` server function, which holds the key):
 *    knows Colombian house numbers ("Calle 19 # 6-48"), so it comes first.
 *  - Photon (komoot, OpenStreetMap): search-as-you-type, ranks near the passenger.
 *  - Nominatim: backup, and reverse geocoding (≤ 1 req/s; callers debounce).
 * If HERE fails (signed out, quota, no network) the OpenStreetMap search works alone.
 * Results are cached per query.
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

// ─── HERE (server function) ────────────────────────────────────────────────

interface HereResult {
  id: string;
  type: string;
  exact: boolean;
  title: string;
  street: string;
  number: string;
  district: string;
  city: string;
  lat: number;
  lng: number;
}

/** After "not configured" or "quota exceeded", skip HERE for a while instead of asking every keystroke. */
let hereOffUntil = 0;

const inArea = (p: LatLng) => {
  const [minLng, minLat, maxLng, maxLat] = BBOX.split(',').map(Number);
  return p.lat >= minLat && p.lat <= maxLat && p.lng >= minLng && p.lng <= maxLng;
};

/** City added to bare addresses so "Calle 19 6-48" isn't looked up in Bogotá. */
function cityHint(near: LatLng) {
  if (COUNTRY_CODE === 'cw') return 'Curaçao';
  const toDosquebradas = Math.hypot(near.lat - 4.8333, near.lng + 75.6722);
  const toPereira = Math.hypot(near.lat - 4.81333, near.lng + 75.69611);
  return toDosquebradas < toPereira ? 'Dosquebradas, Risaralda' : 'Pereira, Risaralda';
}

/**
 * HERE keeps the cross street inside `street` in Colombia ("Calle 19 6" + "48"):
 * shown the local way, "Calle 19 #6-48".
 */
function hereAddress(r: HereResult) {
  if (!r.number) return r.street;
  const m = COUNTRY_CODE === 'co' ? /^(.+)\s(\d+\s?[A-Za-z]?)$/.exec(r.street) : null;
  return m ? `${m[1]} #${m[2]}-${r.number}` : `${r.street} ${r.number}`.trim();
}

async function searchHere(q: string, mode: 'address' | 'place', near: LatLng): Promise<HereResult[] | null> {
  if (!supabase || Date.now() < hereOffUntil) return null;
  try {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return null;
    const { data, error } = await supabase.functions.invoke('address-search', {
      body: { q, mode, lat: near.lat, lng: near.lng, country: COUNTRY_CODE, city: cityHint(near) },
    });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      if (status === 503 || status === 429) hereOffUntil = Date.now() + 10 * 60_000;
      return null;
    }
    return ((data as { results?: HereResult[] }).results ?? []).filter(inArea);
  } catch {
    return null;
  }
}

const fromHere = (r: HereResult): SearchHit => {
  const address = hereAddress(r);
  const isPlace = r.type === 'place';
  return {
    id: `here-${r.id}`,
    kind: 'poi',
    name: isPlace ? r.title : address || r.title.split(',')[0],
    address: address || r.district,
    area: r.district || r.city,
    lat: r.lat,
    lng: r.lng,
  };
};

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

// ─── Colombian addresses ───────────────────────────────────────────────────

/**
 * Colombian street abbreviations → the full words OpenStreetMap uses.
 * "Cra 7 # 19-20", "Cll 19", "Kr 6", "Av 30 de Agosto", "Mz 5 Cs 12"…
 */
const ABBREVIATIONS: [RegExp, string][] = [
  [/\b(ak|av\.?\s*cra|av\.?\s*kr)\.?(?=\s|\d|$)/gi, 'Avenida Carrera'],
  [/\b(ac|av\.?\s*cll|av\.?\s*cl)\.?(?=\s|\d|$)/gi, 'Avenida Calle'],
  [/\b(cra|crr|carr|cr|kra|kr|k)\.?(?=\s|\d|$)/gi, 'Carrera'],
  [/\b(cll|clle|cl|cal)\.?(?=\s|\d|$)/gi, 'Calle'],
  [/\b(avda|avd|av)\.?(?=\s|\d|$)/gi, 'Avenida'],
  [/\b(diag|dg)\.?(?=\s|\d|$)/gi, 'Diagonal'],
  [/\b(transv|trans|tv|tr)\.?(?=\s|\d|$)/gi, 'Transversal'],
  [/\b(mza|mz)\.?(?=\s|\d|$)/gi, 'Manzana'],
  [/\b(cs)\.?(?=\s|\d|$)/gi, 'Casa'],
  [/\b(edif|ed)\.?(?=\s|\d|$)/gi, 'Edificio'],
  [/\b(urb)\.?(?=\s|\d|$)/gi, 'Urbanización'],
  [/\b(cc)\.?(?=\s|$)/gi, 'Centro Comercial'],
  [/\bb\/\s*/gi, 'Barrio '],
  [/\b(br|bro)\.?(?=\s)/gi, 'Barrio'],
];

export function normalizeAddress(q: string): string {
  let s = ` ${q} `;
  for (const [re, full] of ABBREVIATIONS) s = s.replace(re, full);
  // "Calle19" → "Calle 19"; tidy "#", "No." and spaces.
  s = s.replace(/(Calle|Carrera|Avenida|Diagonal|Transversal|Manzana)(\d)/g, '$1 $2');
  s = s.replace(/\b(n[uú]mero|no|n[º°o])\.?\s*(?=\d)/gi, '# ');
  return s.replace(/\s+/g, ' ').replace(/\s*#\s*/g, ' # ').trim();
}

const STREET = '(Avenida Calle|Avenida Carrera|Calle|Carrera|Diagonal|Transversal)';
/** "Calle 19 # 6-48" → main street "Calle 19", cross street "Carrera 6". */
function parseGridAddress(q: string) {
  const m = new RegExp(`^${STREET}\\s+(\\d+\\s?[A-Za-z]?(?:\\s?bis)?)\\s*#?\\s*(\\d+\\s?[A-Za-z]?)\\s*-\\s*(\\d+)`, 'i').exec(q);
  if (!m) return null;
  const type = m[1];
  const crossType = /calle|diagonal/i.test(type) ? 'Carrera' : 'Calle';
  const clean = (n: string) => n.replace(/\s+/g, ' ').trim();
  return { main: `${type.replace(/^Avenida /, '')} ${clean(m[2])}`, cross: `${crossType} ${clean(m[3])}`, label: `${type} ${clean(m[2])} #${clean(m[3])}-${m[4]}` };
}

/** Public Overpass servers, tried in order (the main one refuses some networks). */
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const corners = new Map<string, LatLng | null>();
/** Point where two named streets cross, inside the active area (OpenStreetMap data via Overpass). */
async function intersection(main: string, cross: string): Promise<LatLng | null> {
  const key = `${BBOX}|${main}|${cross}`.toLowerCase();
  if (corners.has(key)) return corners.get(key) ?? null;
  const [minLng, minLat, maxLng, maxLat] = BBOX.split(',');
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\"]/g, '\\$&');
  const query = `[out:json][timeout:8];way["highway"]["name"~"^${esc(main)}( |$)",i](${bbox})->.a;way["highway"]["name"~"^${esc(cross)}( |$)",i](${bbox})->.b;node(w.a)->.na;node(w.b)->.nb;node.na.nb;out 1;`;
  for (const server of OVERPASS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(`${server}?data=${encodeURIComponent(query)}`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: { lat: number; lon: number }[] };
      const n = json.elements?.[0];
      const out = n ? { lat: n.lat, lng: n.lon } : null;
      corners.set(key, out);
      return out;
    } catch {
      // next server
    }
  }
  return null;
}

/** Unit details OpenStreetMap doesn't have ("Manzana 5 Casa 12", "Apto 301") are dropped for the search. */
const stripUnits = (q: string) =>
  q
    .replace(/\b(Manzana|Casa|Lote|Apto|Apartamento|Torre|Interior|Int|Bloque|Piso|Local)\s*[\w-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Places and addresses in the active area, nearest to the passenger first. */
export async function searchPlaces(query: string, near: LatLng = CENTER): Promise<SearchHit[]> {
  const raw = query.trim();
  if (raw.length < 3) return [];
  const q = normalizeAddress(raw);
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;

  const grid = parseGridAddress(q);
  // Text search: without "# 6-48" (OSM rarely has Colombian house numbers) and without unit details.
  const text = stripUnits(grid ? grid.main : q.replace(/\s#.*$/, '')) || q;
  const [here, photon] = await Promise.all([
    // "Calle 19 6-48" (no "#") is how HERE reads Colombian addresses best.
    searchHere(grid ? grid.label.replace(/\s*#\s*/, ' ') : stripUnits(q) || q, grid ? 'address' : 'place', near),
    searchPhoton(text, near),
  ]);

  // A full grid address ("Calle 19 # 6-48"): HERE's house is the best pin, but only
  // when it is the number that was typed (HERE sometimes offers a neighbouring one).
  let exact: SearchHit[] = [];
  if (grid) {
    // "Calle 19" + "6-48" → "calle196-48" (so "Calle 19 16-48" doesn't count).
    const typed = `${grid.main}${grid.label.split('#')[1]}`.replace(/\s/g, '').toLowerCase();
    const house = here?.find((r) => r.type === 'houseNumber' && r.title.split(',')[0].replace(/\s/g, '').toLowerCase().endsWith(typed));
    // Otherwise the corner of both streets beats any text match.
    const corner = house ? null : await intersection(grid.main, grid.cross);
    if (house) exact = [{ ...fromHere(house), name: grid.label }];
    else if (corner) exact = [{ id: `grid-${grid.label.toLowerCase().replace(/\W+/g, '-')}`, kind: 'poi', name: grid.label, address: grid.label, area: '', ...corner }];
  }

  const places = grid ? [] : (here ?? []).map(fromHere);
  const found = photon && photon.length ? photon : await searchNominatim(text);
  const out = dedupe([...exact, ...places, ...found]);
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
