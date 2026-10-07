import type { LatLng } from '../lib/geo';

export type PlaceKind = 'home' | 'work' | 'favorite' | 'recent' | 'poi' | 'current';

export interface Place extends LatLng {
  id: string;
  name: string;
  address: string;
  area: string;
  kind: PlaceKind;
  /** Custom label for saved places, e.g. "Casa de mi mamá". */
  label?: string;
}

/**
 * The active country's places. Pereira by default; applyRegion() swaps them
 * (the app remounts on country change, so screens always read fresh values).
 */

/** Fallback when GPS is unavailable (country centre). */
export let CURRENT_LOCATION: Place = {
  id: 'current',
  name: 'Plaza de Bolívar',
  address: 'Carrera 7 con Calle 19',
  area: 'Centro, Pereira',
  kind: 'current',
  lat: 4.81333,
  lng: -75.69611,
};

/** Popular places (suggestions; search uses OpenStreetMap). */
export let PLACES: Place[] = [
  { id: 'matecana', kind: 'poi', name: 'Aeropuerto Matecaña', address: 'Av. 30 de Agosto', area: 'Pereira', lat: 4.8157, lng: -75.73823 },
  { id: 'utp', kind: 'poi', name: 'Universidad Tecnológica de Pereira', address: 'Carrera 27 #10-02', area: 'Álamos', lat: 4.79637, lng: -75.68885 },
  { id: 'viaducto', kind: 'poi', name: 'Viaducto César Gaviria', address: 'Av. del Ferrocarril', area: 'Centro', lat: 4.81683, lng: -75.68635 },
  { id: 'olaya', kind: 'poi', name: 'Parque Olaya Herrera', address: 'Carrera 13 con Calle 25', area: 'Olaya', lat: 4.80862, lng: -75.69615 },
  { id: 'estadio', kind: 'poi', name: 'Estadio Hernán Ramírez Villegas', address: 'Av. 30 de Agosto', area: 'Villa Olímpica', lat: 4.80572, lng: -75.75274 },
  { id: 'unicentro', kind: 'poi', name: 'Unicentro Pereira', address: 'Av. 30 de Agosto #75-51', area: 'Pereira', lat: 4.80968, lng: -75.74123 },
  { id: 'arboleda', kind: 'poi', name: 'Parque Arboleda', address: 'Carrera 13 #15-73', area: 'Centro', lat: 4.80762, lng: -75.68337 },
  { id: 'victoria', kind: 'poi', name: 'Centro Comercial Victoria', address: 'Carrera 10 #14-71', area: 'Centro', lat: 4.81075, lng: -75.693 },
  { id: 'circunvalar', kind: 'poi', name: 'Avenida Circunvalar', address: 'Av. Circunvalar con Calle 10', area: 'Circunvalar', lat: 4.8066, lng: -75.688 },
  { id: 'ukumari', kind: 'poi', name: 'Bioparque Ukumarí', address: 'Vía Cerritos', area: 'Cerritos', lat: 4.8017, lng: -75.8121 },
  { id: 'dosquebradas', kind: 'poi', name: 'Parque principal de Dosquebradas', address: 'Av. Simón Bolívar', area: 'Dosquebradas', lat: 4.8392, lng: -75.6681 },
  { id: 'pinares', kind: 'poi', name: 'Pinares de San Martín', address: 'Av. Circunvalar', area: 'Pinares', lat: 4.80407, lng: -75.68784 },
  { id: 'cuba', kind: 'poi', name: 'Barrio Cuba', address: 'Av. de las Américas', area: 'Cuba', lat: 4.7862, lng: -75.729 },
];

export const RECENT_IDS: string[] = [];

export const placeById = (id: string) => (id === CURRENT_LOCATION.id ? CURRENT_LOCATION : PLACES.find((p) => p.id === id));

/** Swaps in another country's places. */
export function setRegionPlaces(center: Place, places: Place[], areas: (LatLng & { name: string })[], popular: string[]) {
  CURRENT_LOCATION = center;
  PLACES = places;
  AREA_LABELS = areas;
  POPULAR_IDS = popular;
}

/** Suggested destinations before the user types. */
export let POPULAR_IDS: string[] = ['unicentro', 'matecana', 'utp'];

/** Neighbourhood presets for creating service zones in the admin. */
export let AREA_LABELS: (LatLng & { name: string })[] = [
  { name: 'CENTRO', lat: 4.8133, lng: -75.6961 },
  { name: 'CIRCUNVALAR', lat: 4.8066, lng: -75.688 },
  { name: 'PINARES', lat: 4.8043, lng: -75.6817 },
  { name: 'ÁLAMOS · UTP', lat: 4.7937, lng: -75.6883 },
  { name: 'OLAYA', lat: 4.8081, lng: -75.7014 },
  { name: 'VILLA OLÍMPICA', lat: 4.8064, lng: -75.7242 },
  { name: 'AEROPUERTO', lat: 4.8127, lng: -75.7395 },
  { name: 'CUBA', lat: 4.7862, lng: -75.729 },
  { name: 'CERRITOS', lat: 4.8239, lng: -75.8064 },
  { name: 'DOSQUEBRADAS', lat: 4.8392, lng: -75.6681 },
];
