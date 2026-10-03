import { DAILY_TRIPS, MONTHLY_TRIPS, TRIP_SAMPLE } from '../data/mock';
import { aggregate, PricingConfig } from './fare';

/**
 * Platform metrics. Fares are never stored: every peso is derived from the
 * trip sample (distance, duration, category) run through the fare engine.
 * Per-trip averages from the sample are scaled to the daily/monthly counts.
 */
export function unitEconomics(config: PricingConfig) {
  return aggregate(TRIP_SAMPLE, config);
}

export function dailyRevenue(config: PricingConfig) {
  const u = unitEconomics(config);
  return DAILY_TRIPS.map((d, i) => {
    // Small deterministic wobble so the series reads like real data.
    const wobble = 1 + Math.sin(i * 1.7) * 0.035;
    const volume = Math.round(d.trips * u.averageFare * wobble);
    return {
      date: d.date,
      trips: d.trips,
      cancellations: d.cancellations,
      volume,
      commission: Math.round((volume * config.commissionPct) / 100),
    };
  });
}

export function monthlyRevenue(config: PricingConfig) {
  const u = unitEconomics(config);
  return MONTHLY_TRIPS.map((m) => {
    const volume = m.trips * u.averageFare;
    return { ...m, volume, commission: Math.round((volume * config.commissionPct) / 100) };
  });
}

/**
 * Revenue simulator: projects a month at `next` rates against `current`.
 * Demand reacts to price with a simple elasticity assumption.
 */
export function projectMonth(current: PricingConfig, next: PricingConfig, monthlyTrips: number, elasticity = -0.35) {
  const a = unitEconomics(current);
  const b = unitEconomics(next);
  const priceChange = a.averageFare ? (b.averageFare - a.averageFare) / a.averageFare : 0;
  const demand = Math.max(0, 1 + elasticity * priceChange);
  const tripsNext = Math.round(monthlyTrips * demand);
  const project = (u: typeof a, trips: number) => ({
    trips,
    volume: u.averageFare * trips,
    commission: Math.round((u.averageFare * trips * (u.commission / (u.volume || 1)))),
    driver: Math.round(u.averageDriver * trips),
    averageFare: u.averageFare,
    averageDriver: u.averageDriver,
    minimumShare: u.minimumShare,
  });
  return { current: project(a, monthlyTrips), next: project(b, tripsNext), priceChange, demand };
}
