import { setRegionPlaces } from '../data/places';
import { COUNTRIES, CountryCode } from './countries';
import { setProjectionBounds } from './geo';
import { setSearchArea } from './geocode';
import { setDriverFallback } from './requests';

/**
 * Points every location-dependent module at the country (Colombia): map
 * projection, search area, popular places and the GPS fallback. Called by
 * CountryProvider before the app renders.
 */
let ACTIVE: CountryCode = 'CO';
/** Country the app is currently showing (data loaders filter by it). */
export const activeCountry = () => ACTIVE;

export function applyRegion(code: CountryCode) {
  ACTIVE = code;
  const c = COUNTRIES[code];
  setProjectionBounds(c.bounds);
  setRegionPlaces(c.center, c.places, c.areaLabels, c.popular);
  setSearchArea(c.bounds, c.geoCode, c.center);
  setDriverFallback(c.center);
}
