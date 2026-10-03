import { setRegionPlaces } from '../data/places';
import { COUNTRIES, CountryCode } from './countries';
import { setMoneyCurrency } from './format';
import { setProjectionBounds } from './geo';
import { setSearchArea } from './geocode';
import { setDriverFallback } from './requests';

/**
 * Points every country-dependent module at one country: map projection,
 * currency, search area, popular places and the GPS fallback. Called by
 * CountryProvider before it (re)mounts the app for that country.
 */
let ACTIVE: CountryCode = 'CO';
/** Country the app is currently showing (data loaders filter by it). */
export const activeCountry = () => ACTIVE;

export function applyRegion(code: CountryCode) {
  ACTIVE = code;
  const c = COUNTRIES[code];
  setProjectionBounds(c.bounds);
  setMoneyCurrency(c.currency, c.currencySymbol, c.minorDigits);
  setRegionPlaces(c.center, c.places, c.areaLabels, c.popular);
  setSearchArea(c.bounds, c.geoCode, c.center);
  setDriverFallback(c.center);
}
