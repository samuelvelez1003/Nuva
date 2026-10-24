import type { Place } from './places';

/**
 * Pereira and Dosquebradas places riders ask for most, shown first in the address search
 * with their proper name and a point where a car can stop. Coordinates come from
 * OpenStreetMap (Photon), or are the HERE vehicle entrances already used for the popular
 * places in countries.ts. `also` holds other names people type: Spanish, English,
 * abbreviations and nicknames.
 */
interface Pinned extends Omit<Place, 'id' | 'kind'> {
  also: string[];
  /**
   * Safe meeting point: a staffed, well-lit public place (malls, the airport, the bus
   * terminal, universities, big clinics). Suggested as pickup, above all at night.
   */
  safe?: true;
}

export const PINNED_CO: Pinned[] = [
  { name: 'Aeropuerto Internacional Matecaña', address: 'Av. 30 de Agosto', area: 'Pereira', lat: 4.8157, lng: -75.73823, safe: true, also: ['aeropuerto', 'airport', 'matecaña', 'aeropuerto pereira', 'pei', 'vuelo', 'flight'] },
  { name: 'Terminal de Transportes de Pereira', address: 'Calle 17', area: 'Universidad', lat: 4.80164, lng: -75.69354, safe: true, also: ['terminal', 'terminal de transportes', 'terminal de buses', 'bus station', 'bus terminal', 'buses', 'flota'] },
  { name: 'Plaza de Bolívar', address: 'Carrera 7 con Calle 19', area: 'Centro, Pereira', lat: 4.81435, lng: -75.69467, also: ['bolivar', 'plaza bolivar', 'bolivar desnudo', 'catedral', 'cathedral', 'centro pereira', 'centro de pereira', 'downtown'] },
  { name: 'Unicentro Pereira', address: 'Av. 30 de Agosto #75-51', area: 'Pereira', lat: 4.80968, lng: -75.74123, safe: true, also: ['unicentro', 'cc unicentro', 'mall', 'centro comercial', 'shopping'] },
  { name: 'Parque Arboleda', address: 'Carrera 13 #15-73', area: 'Centro', lat: 4.80762, lng: -75.68337, safe: true, also: ['arboleda', 'cc arboleda', 'mall', 'centro comercial', 'shopping'] },
  { name: 'Centro Comercial Victoria', address: 'Carrera 10 #14-71', area: 'Centro', lat: 4.81075, lng: -75.693, safe: true, also: ['victoria', 'ciudad victoria', 'cc victoria', 'exito victoria', 'mall', 'centro comercial'] },
  { name: 'Pereira Plaza', address: 'Carrera 13 #15-35', area: 'San José', lat: 4.80819, lng: -75.69184, safe: true, also: ['pereira plaza', 'cc pereira plaza', 'mall', 'centro comercial'] },
  { name: 'Centro Comercial El Progreso', address: 'Carrera 16 #38-130', area: 'Dosquebradas', lat: 4.83545, lng: -75.6693, safe: true, also: ['progreso', 'el progreso', 'cc el progreso', 'mall', 'centro comercial'] },
  { name: 'Centro Comercial Único Outlet', address: 'Av. Simón Bolívar', area: 'Dosquebradas', lat: 4.82889, lng: -75.67819, safe: true, also: ['unico', 'unico outlet', 'outlet', 'cc unico', 'mall', 'centro comercial'] },
  { name: 'Universidad Tecnológica de Pereira (UTP)', address: 'Carrera 27 #10-02', area: 'Álamos', lat: 4.79637, lng: -75.68885, safe: true, also: ['utp', 'tecnologica', 'universidad tecnologica', 'technological university', 'university'] },
  { name: 'Universidad Católica de Pereira', address: 'Av. de las Américas #45-95', area: 'Consota', lat: 4.80553, lng: -75.72549, safe: true, also: ['catolica', 'ucp', 'universidad catolica', 'catholic university'] },
  { name: 'Universidad Libre (sede Belmonte)', address: 'Av. de las Américas', area: 'Comuna Olímpica', lat: 4.80518, lng: -75.75977, safe: true, also: ['libre', 'unilibre', 'universidad libre', 'belmonte'] },
  { name: 'Universidad Libre (sede Centro)', address: 'Calle 40 #7-30', area: 'La Palmera', lat: 4.81644, lng: -75.71204, safe: true, also: ['libre', 'unilibre', 'universidad libre'] },
  { name: 'Hospital Universitario San Jorge', address: 'Carrera 4 #24-88', area: 'Centro', lat: 4.81809, lng: -75.69892, safe: true, also: ['san jorge', 'hospital', 'hospital san jorge', 'hospital universitario', 'husj'] },
  { name: 'Hospital Santa Mónica', address: 'Calle Tominejos', area: 'Dosquebradas', lat: 4.82385, lng: -75.68, safe: true, also: ['santa monica', 'hospital santa monica', 'hospital dosquebradas'] },
  { name: 'Clínica Comfamiliar Pereira', address: 'Av. Circunvalar #3-01', area: 'Popular Modelo', lat: 4.8067, lng: -75.68081, safe: true, also: ['comfamiliar', 'clinica comfamiliar', 'clinica', 'clinic'] },
  { name: 'Clínica Los Rosales', address: 'Carrera 9 #25-25', area: 'Centro', lat: 4.81337, lng: -75.69987, safe: true, also: ['rosales', 'los rosales', 'clinica los rosales', 'clinica', 'clinic'] },
  { name: 'Alcaldía de Pereira', address: 'Carrera 7 #18-55', area: 'Centro', lat: 4.81449, lng: -75.6939, also: ['alcaldia', 'alcaldia de pereira', 'alcaldia pereira', 'city hall', 'town hall'] },
  { name: 'Parque Olaya Herrera', address: 'Carrera 13 con Calle 25', area: 'Olaya', lat: 4.80862, lng: -75.69615, also: ['olaya', 'olaya herrera', 'parque olaya'] },
  { name: 'Parque El Lago', address: 'Lago Uribe', area: 'Centro', lat: 4.81478, lng: -75.69888, also: ['el lago', 'parque el lago', 'lago uribe'] },
  { name: 'Viaducto César Gaviria Trujillo', address: 'Av. del Ferrocarril', area: 'Centro', lat: 4.81683, lng: -75.68635, also: ['viaducto', 'viaduct', 'cesar gaviria'] },
  { name: 'Avenida Circunvalar', address: 'Av. Circunvalar con Calle 10', area: 'Circunvalar', lat: 4.8066, lng: -75.688, also: ['circunvalar', 'la circunvalar', 'av circunvalar'] },
  { name: 'Megacentro Pinares', address: 'Carrera 18 #12-75', area: 'Pinares de San Martín', lat: 4.80408, lng: -75.69038, safe: true, also: ['megacentro', 'mega centro', 'pinares'] },
  { name: 'Estadio Hernán Ramírez Villegas', address: 'Av. 30 de Agosto', area: 'Villa Olímpica', lat: 4.80572, lng: -75.75274, also: ['estadio', 'stadium', 'hernan ramirez', 'villa olimpica', 'deportivo pereira'] },
  { name: 'Expofuturo', address: 'Calle 94', area: 'Villasol', lat: 4.80602, lng: -75.75616, also: ['expo futuro', 'feria', 'centro de convenciones', 'convention center'] },
  { name: 'Bioparque Ukumarí', address: 'Vía Cerritos', area: 'Cerritos', lat: 4.8017, lng: -75.8121, also: ['ukumari', 'bioparque', 'zoologico', 'zoo'] },
  { name: 'Cerritos Mall', address: 'Km 5 Vía Cerritos', area: 'Cerritos', lat: 4.81326, lng: -75.80122, safe: true, also: ['cerritos', 'via cerritos'] },
  { name: 'Cuba', address: 'Av. de las Américas', area: 'Cuba', lat: 4.80439, lng: -75.73897, also: ['barrio cuba', 'parque de cuba', 'cuba pereira'] },
  { name: 'Centro Administrativo Municipal (CAM) Dosquebradas', address: 'Calle 36, Av. Simón Bolívar', area: 'Dosquebradas', lat: 4.83378, lng: -75.67092, also: ['dosquebradas', 'centro dosquebradas', 'dosquebradas centro', 'alcaldia de dosquebradas', 'alcaldia dosquebradas', 'cam'] },
];

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Pinned places that match what the rider typed: the query appears in a name, or
 * contains one of its other names ("aeropuerto pereira" → the airport). Best first, at most 3.
 * Only for Colombia (the active geo code from setSearchArea).
 */
export function matchPinned(query: string, countryCode: string): Place[] {
  if (countryCode !== 'co') return [];
  const q = fold(query);
  if (q.length < 3) return [];
  const scored = PINNED_CO.map((p, i) => {
    const names = [fold(p.name), ...p.also.map(fold)];
    const exact = names.some((n) => n === q);
    const starts = names.some((n) => n.startsWith(q) || q.startsWith(`${n} `));
    // Whole words only when the query is longer ("terminal de buses" must not match "bus").
    const has = names.some((n) => n.includes(q) || (n.length >= 4 && ` ${q} `.includes(` ${n} `)));
    const score = exact ? 3 : starts ? 2 : has ? 1 : 0;
    return { p, i, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, 3);
  return scored.map(({ p, i }) => ({ id: `pin-${i}`, kind: 'poi', name: p.name, address: p.address, area: p.area, lat: p.lat, lng: p.lng }));
}

/** Straight-line distance in km (haversine): plenty for "what's near" lists. */
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r;
  const dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Safe meeting points within `km` of a point, nearest first (at most 4), as pickup places. */
export function safePointsNear(lat: number, lng: number, km = 1.5): (Place & { distanceKm: number })[] {
  return PINNED_CO.map((p, i) => ({ p, i, d: distanceKm(lat, lng, p.lat, p.lng) }))
    .filter((x) => x.p.safe && x.d <= km)
    .sort((a, b) => a.d - b.d)
    .slice(0, 4)
    .map(({ p, i, d }) => ({ id: `pin-${i}`, kind: 'poi' as const, name: p.name, address: p.address, area: p.area, lat: p.lat, lng: p.lng, distanceKm: d }));
}

/**
 * Is this place one of the safe meeting points? Same name, or (with coordinates) within
 * ~50 m of its entrance — search hits and saved places carry their own ids.
 */
export function isSafePlace(p: { name: string; lat: number; lng: number }) {
  const name = fold(p.name);
  return PINNED_CO.some(
    (s) => s.safe && (fold(s.name) === name || (Number.isFinite(p.lat) && Number.isFinite(p.lng) && distanceKm(p.lat, p.lng, s.lat, s.lng) < 0.05)),
  );
}
