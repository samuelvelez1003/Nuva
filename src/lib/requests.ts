import { CommissionRule, driverFare } from './commission';
import { CURRENT_LOCATION, Place, PLACES } from '../data/places';
import { PASSENGER_NAMES, rng } from '../data/mock';
import { calculateFare, CategoryId, FareBreakdown, PricingConfig } from './fare';
import { buildRoute, LatLng, NavStep, offset, Pt, routeMetrics, trafficNow } from './geo';
import { placeFrom, TripRow } from './liveTrips';
import { es } from '../i18n/es';

/** Fallback driver position when there's no GPS: the active country's centre. */
export let DRIVER_LOCATION: LatLng = { lat: 4.8105, lng: -75.6905 };
export function setDriverFallback(p: LatLng) {
  DRIVER_LOCATION = { lat: p.lat, lng: p.lng };
}

export interface RideRequest {
  id: string;
  passenger: string;
  passengerRating: number;
  /** Promo discount: the passenger pays fare − discount; NÜVA credits it to the driver. */
  discount?: number;
  pickup: Place;
  destination: Place;
  approach: Pt[];
  route: Pt[];
  pickupKm: number;
  pickupMin: number;
  fare: FareBreakdown;
  category: CategoryId;
  payment: string;
  /** Server trip id when this is a real request. */
  tripId?: string;
  /** Turn-by-turn steps from the street router, when available. */
  approachSteps?: NavStep[];
  routeSteps?: NavStep[];
}

/**
 * Spanish source labels (from the i18n dictionary). `RideRequest.payment` keeps
 * this label; screens show it translated with `paymentLabel(req.payment, t)` from data/mock.
 */
const PAYMENT_LABEL: Record<string, string> = {
  cash: es['pay.cash.label'],
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  bancolombia: 'Bancolombia',
  transfer: es['pay.transfer.label'],
  card: es['pay.card.label'],
};

/** A real server trip shaped as an incoming request card. */
export function requestFromTrip(t: TripRow, from: LatLng = DRIVER_LOCATION, rule?: CommissionRule | null): RideRequest {
  const pickup = placeFrom(t.pickup, `pk-${t.id}`);
  const destination = placeFrom(t.destination, `dst-${t.id}`);
  const approach = buildRoute(from, pickup);
  const a = routeMetrics(approach, trafficNow());
  return {
    id: t.code,
    tripId: t.id,
    passenger: 'Pasajero NÜVA',
    passengerRating: 5,
    pickup,
    destination,
    approach,
    route: buildRoute(pickup, destination),
    pickupKm: a.distanceKm,
    pickupMin: Math.max(1, a.durationMin - 1),
    // Still open: show this driver's commission (accept_ride fixes the same one). Taken: the server's.
    fare: t.status === 'requested' ? driverFare(t.fare, rule) : t.fare,
    discount: t.discount ?? 0,
    category: t.category,
    payment: PAYMENT_LABEL[t.payment] ?? t.payment,
  };
}

const PICKUP_STREETS = ['Calle 19 #6-48', 'Carrera 7 #24-15', 'Calle 14 #12-30', 'Carrera 10 #17-55', 'Avenida 30 de Agosto #35-20', 'Calle 22 #8-04'];

/**
 * Builds a realistic incoming request around the driver, priced with the
 * live pricing config — the same engine the passenger app uses.
 */
export function createRequest(seed: number, pricing: PricingConfig): RideRequest {
  const r = rng(seed);
  const pickupLL = offset(DRIVER_LOCATION, (r() - 0.5) * 2200, (r() - 0.5) * 1800);
  const pickup: Place = {
    ...CURRENT_LOCATION,
    id: `pk-${seed}`,
    kind: 'poi',
    name: PICKUP_STREETS[Math.floor(r() * PICKUP_STREETS.length)],
    address: PICKUP_STREETS[Math.floor(r() * PICKUP_STREETS.length)],
    area: 'Centro',
    ...pickupLL,
  };
  const candidates = PLACES.filter((p) => p.kind === 'poi');
  const destination = candidates[Math.floor(r() * candidates.length)];
  const approach = buildRoute(DRIVER_LOCATION, pickup);
  const route = buildRoute(pickup, destination);
  const traffic = trafficNow();
  const a = routeMetrics(approach, traffic);
  const m = routeMetrics(route, traffic);
  const categories: CategoryId[] = ['go', 'go', 'go', 'confort', 'eco'];
  const category = categories[Math.floor(r() * categories.length)];
  return {
    id: `RQ-${seed}`,
    passenger: PASSENGER_NAMES[Math.floor(r() * PASSENGER_NAMES.length)],
    passengerRating: Math.round((4.6 + r() * 0.39) * 100) / 100,
    pickup,
    destination,
    approach,
    route,
    pickupKm: a.distanceKm,
    pickupMin: Math.max(2, a.durationMin - 1),
    fare: calculateFare(m, pricing, category),
    category,
    payment: (['Nequi', 'Efectivo', 'Daviplata', 'Bancolombia'] as const)[Math.floor(r() * 4)],
  };
}
