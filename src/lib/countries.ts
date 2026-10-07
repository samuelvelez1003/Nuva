import type { Place } from '../data/places';
import { translate, useLanguage, type Lang, type TKey } from '../i18n';
import type { LatLng } from './geo';

/**
 * Countries where NÜVA operates. Everything location- or money-specific hangs
 * off this config: map projection, search area, currency, phone format,
 * payment methods and the popular places shown before the user types.
 *
 * Money is always an integer in the local currency's minor unit
 * (Colombia: COP pesos; Curaçao: XCG cents — Caribbean guilder, "Cg").
 */

export type CountryCode = 'CO' | 'CW';
export type CurrencyCode = 'COP' | 'XCG';
export type PaymentId = 'cash' | 'nequi' | 'daviplata' | 'bancolombia' | 'transfer' | 'card';

export interface Country {
  code: CountryCode;
  name: string;
  flag: string;
  /** Launch city shown in copy, e.g. "Pereira". */
  city: string;
  cityLong: string;
  currency: CurrencyCode;
  /** How amounts are written: "$" (COP) or "Cg" (Caribbean guilder). */
  currencySymbol: string;
  currencyName: string;
  /** 0 = whole units (COP), 2 = cents (XCG). */
  minorDigits: 0 | 2;
  phonePrefix: string;
  phonePlaceholder: string;
  /** Validates the local phone digits (no prefix). */
  phoneValid: (digits: string) => boolean;
  phoneMaxDigits: number;
  timeZone: string;
  /** Search + projection area (lat/lng box). */
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  /** ISO code used by the geocoders. */
  geoCode: string;
  /** Fallback pickup when GPS is off. */
  center: Place;
  places: Place[];
  /** Ids of `places` used as suggestions (home screen, landing calculator). */
  popular: string[];
  areaLabels: (LatLng & { name: string })[];
  payments: PaymentId[];
  /** How drivers top up their NÜVA balance. */
  topup: 'wompi' | 'manual';
  /** Documents asked to drivers at sign-up. */
  driverDocs: 'nequi' | 'license-insurance';
  /** Website copy and examples for this country. */
  web: {
    heroDest: string;
    calcOrigins: string[];
    calcDests: string[];
    currencyNote: string;
    paymentNames: string[];
    payFaq: string;
    citiesFaq: string;
    driverFaq: string;
    emergency: string;
    footer: string;
  };
}

const poi = (id: string, name: string, address: string, area: string, lat: number, lng: number): Place => ({ id, kind: 'poi', name, address, area, lat, lng });

export const COUNTRIES: Record<CountryCode, Country> = {
  CO: {
    code: 'CO',
    name: 'Colombia',
    flag: '🇨🇴',
    city: 'Pereira',
    cityLong: 'Pereira y Dosquebradas',
    currency: 'COP',
    currencySymbol: '$',
    currencyName: 'Pesos colombianos',
    minorDigits: 0,
    phonePrefix: '+57',
    phonePlaceholder: '300 000 0000',
    phoneValid: (d) => /^3\d{9}$/.test(d),
    phoneMaxDigits: 10,
    timeZone: 'America/Bogota',
    bounds: { minLat: 4.74, maxLat: 4.88, minLng: -75.82, maxLng: -75.6 },
    geoCode: 'co',
    center: { id: 'current', kind: 'current', name: 'Plaza de Bolívar', address: 'Carrera 7 con Calle 19', area: 'Centro, Pereira', lat: 4.81333, lng: -75.69611 },
    // Coordinates = the vehicle entrance (HERE "access" point), so pins and routes arrive
    // where a car really stops. Verified 2026-10-06 against HERE and OpenStreetMap.
    places: [
      poi('matecana', 'Aeropuerto Matecaña', 'Av. 30 de Agosto', 'Pereira', 4.8157, -75.73823),
      poi('utp', 'Universidad Tecnológica de Pereira', 'Carrera 27 #10-02', 'Álamos', 4.79637, -75.68885),
      poi('viaducto', 'Viaducto César Gaviria', 'Av. del Ferrocarril', 'Centro', 4.81683, -75.68635),
      poi('olaya', 'Parque Olaya Herrera', 'Carrera 13 con Calle 25', 'Olaya', 4.80862, -75.69615),
      poi('estadio', 'Estadio Hernán Ramírez Villegas', 'Av. 30 de Agosto', 'Villa Olímpica', 4.80572, -75.75274),
      poi('unicentro', 'Unicentro Pereira', 'Av. 30 de Agosto #75-51', 'Pereira', 4.80968, -75.74123),
      poi('arboleda', 'Parque Arboleda', 'Carrera 13 #15-73', 'Centro', 4.80762, -75.68337),
      poi('victoria', 'Centro Comercial Victoria', 'Carrera 10 #14-71', 'Centro', 4.81075, -75.693),
      poi('circunvalar', 'Avenida Circunvalar', 'Av. Circunvalar con Calle 10', 'Circunvalar', 4.8066, -75.688),
      poi('ukumari', 'Bioparque Ukumarí', 'Vía Cerritos', 'Cerritos', 4.8017, -75.8121),
      poi('dosquebradas', 'Parque principal de Dosquebradas', 'Av. Simón Bolívar', 'Dosquebradas', 4.8392, -75.6681),
      poi('pinares', 'Pinares de San Martín', 'Av. Circunvalar', 'Pinares', 4.80407, -75.68784),
      poi('cuba', 'Barrio Cuba', 'Av. de las Américas', 'Cuba', 4.7862, -75.729),
    ],
    popular: ['unicentro', 'matecana', 'utp'],
    areaLabels: [
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
    ],
    payments: ['cash', 'nequi', 'daviplata', 'bancolombia'],
    topup: 'wompi',
    driverDocs: 'nequi',
    web: {
      heroDest: 'unicentro',
      calcOrigins: ['current', 'utp', 'dosquebradas', 'cuba'],
      calcDests: ['matecana', 'unicentro', 'estadio', 'circunvalar', 'ukumari'],
      currencyNote: 'Precios en pesos colombianos.',
      paymentNames: ['Efectivo', 'Nequi', 'Daviplata', 'Bancolombia'],
      payFaq: 'Le pagas directo a tu conductor: en efectivo, por Nequi, Daviplata o transferencia Bancolombia. La app te muestra su número al iniciar el viaje.',
      citiesFaq: 'Empezamos en Pereira y Dosquebradas, Colombia. También operamos en Curazao.',
      driverFaq: 'Descarga la app, crea tu cuenta de conductor, registra tu vehículo y tu Nequi. Revisamos tus datos (licencia, SOAT y tecnomecánica) y te aprobamos para recibir viajes.',
      emergency: 'Llama a la Línea 123 desde la app en un toque.',
      footer: 'Pereira, Colombia',
    },
  },
  CW: {
    code: 'CW',
    name: 'Curazao',
    flag: '🇨🇼',
    city: 'Willemstad',
    cityLong: 'Curazao',
    currency: 'XCG',
    currencySymbol: 'Cg',
    currencyName: 'Florín caribeño',
    minorDigits: 2,
    phonePrefix: '+599',
    phonePlaceholder: '9 512 3456',
    // Curaçao numbers: 9 + 7 digits (mobiles start 95/96/97…); landlines 7 digits after the 9 too.
    phoneValid: (d) => /^9\d{7}$/.test(d),
    phoneMaxDigits: 8,
    timeZone: 'America/Curacao',
    bounds: { minLat: 12.0, maxLat: 12.4, minLng: -69.2, maxLng: -68.7 },
    geoCode: 'cw',
    center: { id: 'current', kind: 'current', name: 'Punda', address: 'Breedestraat', area: 'Willemstad', lat: 12.10538, lng: -68.93366 },
    places: [
      poi('cur-airport', 'Aeropuerto Internacional Hato', 'Plaza Margareth Abraham', 'Hato', 12.18456, -68.957),
      poi('punda', 'Punda', 'Breedestraat', 'Willemstad', 12.10538, -68.93366),
      poi('otrobanda', 'Otrobanda', 'Breedestraat (Otrobanda)', 'Willemstad', 12.11026, -68.93798),
      poi('pietermaai', 'Pietermaai', 'Pietermaai', 'Willemstad', 12.10326, -68.92847),
      poi('megapier', 'Mega Pier (cruceros)', 'Otrobanda', 'Willemstad', 12.1044, -68.94181),
      poi('mambo', 'Mambo Beach', 'Bapor Kibra', 'Willemstad', 12.08802, -68.89793),
      poi('janthiel', 'Jan Thiel', 'Jan Thiel', 'Jan Thiel', 12.08521, -68.87656),
      poi('sambil', 'Sambil Shopping Mall', 'Weg naar Santa Rosa', 'Willemstad', 12.1358, -68.9576),
      poi('cmc', 'Curaçao Medical Center', 'J.H.J. Hamelbergweg', 'Willemstad', 12.11074, -68.94122),
      poi('brievengat', 'Brievengat', 'Brievengat', 'Brievengat', 12.14907, -68.89387),
      poi('westpunt', 'Westpunt', 'Westpunt', 'Westpunt', 12.38082, -69.16259),
    ],
    popular: ['cur-airport', 'mambo', 'otrobanda'],
    areaLabels: [
      { name: 'PUNDA', lat: 12.10538, lng: -68.93366 },
      { name: 'OTROBANDA', lat: 12.11026, lng: -68.93798 },
      { name: 'PIETERMAAI', lat: 12.10326, lng: -68.92847 },
      { name: 'HATO', lat: 12.18905, lng: -68.96216 },
      { name: 'MAMBO BEACH', lat: 12.0869, lng: -68.89937 },
      { name: 'JAN THIEL', lat: 12.08521, lng: -68.87656 },
      { name: 'BRIEVENGAT', lat: 12.14907, lng: -68.89387 },
      { name: 'WESTPUNT', lat: 12.38082, lng: -69.16259 },
    ],
    payments: ['cash', 'transfer', 'card'],
    topup: 'manual',
    driverDocs: 'license-insurance',
    web: {
      heroDest: 'mambo',
      calcOrigins: ['current', 'cur-airport', 'otrobanda', 'brievengat'],
      calcDests: ['cur-airport', 'mambo', 'janthiel', 'sambil', 'westpunt'],
      currencyNote: 'Precios en florines caribeños (Cg · XCG).',
      paymentNames: ['Efectivo', 'Transferencia', 'Tarjeta'],
      payFaq: 'Le pagas directo a tu conductor: en efectivo, por transferencia bancaria o con tarjeta. La app te muestra cómo pagarle al iniciar el viaje.',
      citiesFaq: 'Operamos en toda la isla de Curazao, desde Willemstad hasta Westpunt. También estamos en Pereira, Colombia.',
      driverFaq: 'Descarga la app, crea tu cuenta de conductor y registra tu vehículo, tu licencia de conducción y la fecha de vigencia de tu seguro. Revisamos tus datos y te aprobamos para recibir viajes.',
      emergency: 'Llama al 911 desde la app en un toque.',
      footer: 'Willemstad, Curazao',
    },
  },
};

export const COUNTRY_ORDER: CountryCode[] = ['CO', 'CW'];
export const isCountryCode = (c: unknown): c is CountryCode => c === 'CO' || c === 'CW';

// ─── Translated copy ────────────────────────────────────────────────────────
// The Spanish fields above stay as the source / fallback. Translations live in
// the i18n dictionaries under `country.*`. City and place names are proper
// nouns and stay as they are, except the few generic ones in PLACE_KEYS.

/** Text fields of a country that change with the language. */
export type CountryTextField = 'name' | 'cityLong' | 'currencyName' | 'currencyNote' | 'payFaq' | 'citiesFaq' | 'driverFaq' | 'emergency' | 'footer';

const TEXT_KEYS: Record<CountryCode, Record<CountryTextField, TKey>> = {
  CO: {
    name: 'country.CO.name',
    cityLong: 'country.CO.cityLong',
    currencyName: 'country.CO.currencyName',
    currencyNote: 'country.CO.currencyNote',
    payFaq: 'country.CO.payFaq',
    citiesFaq: 'country.CO.citiesFaq',
    driverFaq: 'country.CO.driverFaq',
    emergency: 'country.CO.emergency',
    footer: 'country.CO.footer',
  },
  CW: {
    name: 'country.CW.name',
    cityLong: 'country.CW.cityLong',
    currencyName: 'country.CW.currencyName',
    currencyNote: 'country.CW.currencyNote',
    payFaq: 'country.CW.payFaq',
    citiesFaq: 'country.CW.citiesFaq',
    driverFaq: 'country.CW.driverFaq',
    emergency: 'country.CW.emergency',
    footer: 'country.CW.footer',
  },
};

/** Generic payment names (brands like Nequi or Bancolombia are not translated). */
const PAYMENT_KEYS: Record<string, TKey> = {
  Efectivo: 'country.pay.cash',
  Transferencia: 'country.pay.transfer',
  Tarjeta: 'country.pay.card',
};

/** Place ids whose name has a translatable part ("Aeropuerto…", "(cruceros)"). */
const PLACE_KEYS: Record<string, TKey> = {
  matecana: 'country.place.matecana',
  dosquebradas: 'country.place.dosquebradas',
  'cur-airport': 'country.place.curAirport',
  megapier: 'country.place.megapier',
};

/** One translated text of a country, e.g. `countryText('CW', 'name', 'pap')` → "Kòrsou". */
export function countryText(code: CountryCode, field: CountryTextField, lang: Lang): string {
  return translate(lang, TEXT_KEYS[code][field]);
}

/** Payment method name in `lang` ("Efectivo" → "Cash"); brands pass through. */
export function paymentName(name: string, lang: Lang): string {
  const key = PAYMENT_KEYS[name];
  return key ? translate(lang, key) : name;
}

/** Place name in `lang`; proper nouns pass through unchanged. */
export function placeName(place: Pick<Place, 'id' | 'name'>, lang: Lang): string {
  const key = PLACE_KEYS[place.id];
  return key ? translate(lang, key) : place.name;
}

const localized: Partial<Record<string, Country>> = {};

/**
 * The country config with every user-facing text in `lang`. Same shape as
 * `COUNTRIES[code]`, so it can replace it anywhere; cached per code + language.
 */
export function localizeCountry(code: CountryCode, lang: Lang): Country {
  const cacheKey = `${code}:${lang}`;
  const hit = localized[cacheKey];
  if (hit) return hit;
  const base = COUNTRIES[code];
  const text = (field: CountryTextField) => countryText(code, field, lang);
  const out: Country = {
    ...base,
    name: text('name'),
    cityLong: text('cityLong'),
    currencyName: text('currencyName'),
    places: base.places.map((p) => ({ ...p, name: placeName(p, lang) })),
    web: {
      ...base.web,
      currencyNote: text('currencyNote'),
      paymentNames: base.web.paymentNames.map((n) => paymentName(n, lang)),
      payFaq: text('payFaq'),
      citiesFaq: text('citiesFaq'),
      driverFaq: text('driverFaq'),
      emergency: text('emergency'),
      footer: text('footer'),
    },
  };
  localized[cacheKey] = out;
  return out;
}

/**
 * Translated copy of a country for the current UI language:
 * `const copy = useCountryCopy(country.code); copy.web.paymentNames`.
 */
export function useCountryCopy(code: CountryCode): Country {
  const { lang } = useLanguage();
  return localizeCountry(code, lang);
}
