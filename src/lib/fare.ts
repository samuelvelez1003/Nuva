/**
 * NÜVA dynamic fare engine.
 *
 *   rawFare            = baseFare + distanceKm * pricePerKm + durationMinutes * pricePerMinute
 *   finalFare          = max(minimumFare, rawFare) + surcharges (night, airport)
 *   platformCommission = (finalFare − surcharges) * commission % (category's own %, else the global one)
 *                        — surcharges are 100 % the driver's
 *   driverEarnings     = finalFare - platformCommission
 *
 * Every amount is an integer number of Colombian pesos. Fractions are only
 * allowed in the inputs (km, minutes, %) and are rounded once per component
 * so the breakdown always adds up exactly to the total.
 */

export type CategoryId = 'moto' | 'go' | 'eco' | 'confort' | 'xl';

export interface CategoryPricing {
  id: CategoryId;
  name: string;
  tagline: string;
  seats: number;
  /** Multiplier applied to the distance + time components. 1 = standard. */
  multiplier: number;
  /** Category-specific minimum. Never lower than the global minimum. */
  minimumFare: number;
  enabled: boolean;
  etaMinutes: number;
  /** Commission for this category only; null/undefined = the global commission. */
  commissionPct?: number | null;
}

/**
 * Fixed surcharges, like the taxi's (Pereira 2026: night $1.300, airport entry
 * $3.300, airport exit $5.000). Same rules as the server's calculate_fare.
 */
export interface Surcharges {
  /** Charged when the trip is requested inside [from, to) local time; the window may cross midnight. */
  night: { enabled: boolean; amount: number; from: string; to: string };
  /** `pickup` when the trip starts at the airport, `dropoff` when it ends there (both can apply). */
  airport: { enabled: boolean; pickup: number; dropoff: number; lat: number; lng: number; radiusM: number };
}

export interface PricingConfig {
  baseFare: number;
  pricePerKm: number;
  pricePerMinute: number;
  minimumFare: number;
  /** Commission as a percentage, e.g. 12 for 12 %. */
  commissionPct: number;
  categories: Record<CategoryId, CategoryPricing>;
  /** Missing on versions published before surcharges existed (= none). */
  surcharges?: Surcharges;
}

export interface TripMetrics {
  distanceKm: number;
  durationMin: number;
}

/** Where and when the trip happens: only then can surcharges apply (quotes and requests). */
export interface TripContext {
  pickup?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  at?: Date;
  /** Country of the pricing, for its local time (CO UTC−5, CW UTC−4, no daylight saving). */
  country?: 'CO' | 'CW';
}

export interface FareBreakdown {
  category: CategoryId;
  distanceKm: number;
  durationMin: number;
  baseFare: number;
  distanceCharge: number;
  timeCharge: number;
  rawFare: number;
  /** Extra charged to reach the minimum fare (0 if not applied). */
  minimumAdjustment: number;
  minimumApplied: boolean;
  nightSurcharge: number;
  airportSurcharge: number;
  finalFare: number;
  commissionPct: number;
  platformCommission: number;
  driverEarnings: number;
}

export const CATEGORY_ORDER: CategoryId[] = ['moto', 'go', 'eco', 'confort', 'xl'];

export const DEFAULT_PRICING: PricingConfig = {
  baseFare: 2000,
  pricePerKm: 1000,
  pricePerMinute: 100,
  minimumFare: 6000,
  commissionPct: 12,
  categories: {
    moto: {
      id: 'moto',
      name: 'Moto',
      tagline: 'Rápido entre el trancón',
      seats: 1,
      multiplier: 0.7,
      minimumFare: 6000,
      enabled: true,
      etaMinutes: 2,
    },
    go: {
      id: 'go',
      name: 'Go',
      tagline: 'El viaje de todos los días',
      seats: 4,
      multiplier: 1,
      minimumFare: 6000,
      enabled: true,
      etaMinutes: 3,
    },
    eco: {
      id: 'eco',
      name: 'Eléctrico',
      tagline: 'Cero emisiones, mismo precio justo',
      seats: 4,
      multiplier: 1.05,
      minimumFare: 6500,
      enabled: true,
      etaMinutes: 5,
    },
    confort: {
      id: 'confort',
      name: 'Confort',
      tagline: 'Carros nuevos, conductores top',
      seats: 4,
      multiplier: 1.3,
      minimumFare: 8000,
      enabled: true,
      etaMinutes: 4,
    },
    xl: {
      id: 'xl',
      name: 'XL',
      tagline: 'Hasta 6 personas y maletas',
      seats: 6,
      multiplier: 1.6,
      minimumFare: 10000,
      enabled: true,
      etaMinutes: 7,
    },
  },
};

/** Curaçao launch rates, in XCG cents (Caribbean guilder; the server holds the published ones). */
export const DEFAULT_PRICING_CW: PricingConfig = {
  baseFare: 700,
  pricePerKm: 270,
  pricePerMinute: 45,
  minimumFare: 1450,
  commissionPct: 12,
  categories: {
    moto: { ...DEFAULT_PRICING.categories.moto, tagline: 'Rápido y económico', minimumFare: 1250, enabled: false },
    go: { ...DEFAULT_PRICING.categories.go, minimumFare: 1450, etaMinutes: 4 },
    eco: { ...DEFAULT_PRICING.categories.eco, minimumFare: 1600, etaMinutes: 6 },
    confort: { ...DEFAULT_PRICING.categories.confort, minimumFare: 2000, etaMinutes: 5 },
    xl: { ...DEFAULT_PRICING.categories.xl, minimumFare: 2500, etaMinutes: 8 },
  },
};

export const defaultPricingFor = (country: 'CO' | 'CW') => (country === 'CW' ? DEFAULT_PRICING_CW : DEFAULT_PRICING);

/**
 * Starting surcharges per country (off until the admin publishes them). The airport zone is
 * a small circle on the terminal entrance: Unicentro is only ~740 m from Matecaña's.
 */
export const defaultSurchargesFor = (country: 'CO' | 'CW'): Surcharges =>
  country === 'CW'
    ? { night: { enabled: false, amount: 400, from: '22:00', to: '06:00' }, airport: { enabled: false, pickup: 0, dropoff: 0, lat: 12.18456, lng: -68.957, radiusM: 400 } }
    : { night: { enabled: false, amount: 1300, from: '19:00', to: '05:00' }, airport: { enabled: false, pickup: 5000, dropoff: 3300, lat: 4.8157, lng: -75.73823, radiusM: 300 } };

const UTC_OFFSET_H: Record<'CO' | 'CW', number> = { CO: -5, CW: -4 };
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
/** Is `at` inside [from, to) in the country's local time? The window may cross midnight. */
export function inNightWindow(at: Date, from: string, to: string, country: 'CO' | 'CW' = 'CO') {
  const local = (((at.getUTCHours() + UTC_OFFSET_H[country]) * 60 + at.getUTCMinutes()) % 1440 + 1440) % 1440;
  const f = minutesOf(from);
  const t = minutesOf(to);
  return f <= t ? local >= f && local < t : local >= f || local < t;
}
const metersBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lat - b.lat) * 110574, (a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180));

function surchargesFor(config: PricingConfig, ctx?: TripContext) {
  const s = config.surcharges;
  if (!s || !ctx || (!ctx.pickup && !ctx.destination)) return { night: 0, airport: 0 };
  const night = s.night?.enabled && inNightWindow(ctx.at ?? new Date(), s.night.from, s.night.to, ctx.country) ? toInt(s.night.amount) : 0;
  let airport = 0;
  if (s.airport?.enabled) {
    const near = (p?: { lat: number; lng: number }) => !!p && metersBetween(p, s.airport) <= s.airport.radiusM;
    if (near(ctx.pickup)) airport += toInt(s.airport.pickup);
    if (near(ctx.destination)) airport += toInt(s.airport.dropoff);
  }
  return { night, airport };
}

const toInt = (n: number) => Math.round(Number.isFinite(n) ? n : 0);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Commission that applies to a category: its own when set, otherwise the global one. */
export function categoryCommission(config: PricingConfig, categoryId: CategoryId): number {
  const own = config.categories[categoryId]?.commissionPct;
  return own == null || !Number.isFinite(own) ? config.commissionPct : own;
}

/** Lowest and highest commission across enabled categories (for public copy). */
export function commissionRange(config: PricingConfig) {
  const all = CATEGORY_ORDER.filter((id) => config.categories[id]?.enabled).map((id) => categoryCommission(config, id));
  const list = all.length ? all : [config.commissionPct];
  return { min: Math.min(...list), max: Math.max(...list) };
}

const pctText = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')} %`;

/** "12 %" when every category charges the same, otherwise "8 % a 12 %". */
export function commissionText(config: PricingConfig) {
  const { min, max } = commissionRange(config);
  return min === max ? pctText(min) : `${pctText(min)} a ${pctText(max)}`;
}

/**
 * Calculates the full breakdown for one trip and one category. Surcharges only
 * apply with a `ctx` (a real quote or request), never to generic examples.
 */
export function calculateFare(
  trip: TripMetrics,
  config: PricingConfig,
  categoryId: CategoryId = 'go',
  ctx?: TripContext,
): FareBreakdown {
  const category = config.categories[categoryId];
  const multiplier = category?.multiplier ?? 1;
  const distanceKm = Math.max(0, trip.distanceKm);
  const durationMin = Math.max(0, trip.durationMin);

  const baseFare = toInt(config.baseFare);
  const distanceCharge = toInt(distanceKm * config.pricePerKm * multiplier);
  const timeCharge = toInt(durationMin * config.pricePerMinute * multiplier);
  const rawFare = baseFare + distanceCharge + timeCharge;

  const minimumFare = toInt(Math.max(config.minimumFare, category?.minimumFare ?? 0));
  const fareBeforeSurcharges = Math.max(minimumFare, rawFare);
  const minimumApplied = fareBeforeSurcharges > rawFare;
  const extra = surchargesFor(config, ctx);
  const finalFare = fareBeforeSurcharges + extra.night + extra.airport;

  const commissionPct = clamp(categoryCommission(config, categoryId), 0, 100);
  const platformCommission = toInt((fareBeforeSurcharges * commissionPct) / 100);
  const driverEarnings = finalFare - platformCommission;

  return {
    category: categoryId,
    distanceKm,
    durationMin,
    baseFare,
    distanceCharge,
    timeCharge,
    rawFare,
    minimumAdjustment: fareBeforeSurcharges - rawFare,
    minimumApplied,
    nightSurcharge: extra.night,
    airportSurcharge: extra.airport,
    finalFare,
    commissionPct,
    platformCommission,
    driverEarnings,
  };
}

/** Quotes every enabled category for the same trip. */
export function quoteAll(trip: TripMetrics, config: PricingConfig): FareBreakdown[] {
  return CATEGORY_ORDER.filter((id) => config.categories[id]?.enabled).map((id) =>
    calculateFare(trip, config, id),
  );
}

/** Aggregates a set of trips — used by the admin revenue simulator. */
export function aggregate(
  trips: (TripMetrics & { category: CategoryId })[],
  config: PricingConfig,
) {
  let volume = 0;
  let commission = 0;
  let driver = 0;
  let minimumHits = 0;
  for (const t of trips) {
    const f = calculateFare(t, config, t.category);
    volume += f.finalFare;
    commission += f.platformCommission;
    driver += f.driverEarnings;
    if (f.minimumApplied) minimumHits += 1;
  }
  const count = trips.length || 1;
  return {
    trips: trips.length,
    volume,
    commission,
    driver,
    averageFare: Math.round(volume / count),
    averageDriver: Math.round(driver / count),
    minimumShare: minimumHits / count,
  };
}

/** Validates admin input. Returns a map of field → Spanish error message. */
export function validatePricing(config: PricingConfig): Partial<Record<keyof PricingConfig, string>> {
  const errors: Partial<Record<keyof PricingConfig, string>> = {};
  if (!Number.isInteger(config.baseFare) || config.baseFare < 0) errors.baseFare = 'Usa un valor entero ≥ 0';
  if (!Number.isInteger(config.pricePerKm) || config.pricePerKm <= 0) errors.pricePerKm = 'Debe ser mayor a 0';
  if (!Number.isInteger(config.pricePerMinute) || config.pricePerMinute < 0)
    errors.pricePerMinute = 'Usa un valor entero ≥ 0';
  if (!Number.isInteger(config.minimumFare) || config.minimumFare < 0) errors.minimumFare = 'Usa un valor entero ≥ 0';
  if (config.commissionPct < 0 || config.commissionPct > 40)
    errors.commissionPct = 'Entre 0 % y 40 %';
  const badCategory = CATEGORY_ORDER.find((id) => {
    const c = config.categories[id]?.commissionPct;
    return c != null && (!Number.isFinite(c) || c < 0 || c > 40);
  });
  if (badCategory) errors.categories = `Comisión de ${config.categories[badCategory].name}: entre 0 % y 40 %`;
  const sc = config.surcharges;
  if (sc) {
    const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
    const amounts = [sc.night.amount, sc.airport.pickup, sc.airport.dropoff];
    if (!hhmm.test(sc.night.from) || !hhmm.test(sc.night.to)) errors.surcharges = 'Horario nocturno: usa el formato 24 h, por ejemplo 19:00';
    else if (sc.night.from === sc.night.to) errors.surcharges = 'El horario nocturno no puede empezar y terminar a la misma hora';
    else if (amounts.some((v) => !Number.isInteger(v) || v < 0)) errors.surcharges = 'Los recargos deben ser valores enteros ≥ 0';
    else if (!(sc.airport.radiusM >= 50 && sc.airport.radiusM <= 3000)) errors.surcharges = 'El radio del aeropuerto debe estar entre 50 y 3.000 m';
  }
  return errors;
}
