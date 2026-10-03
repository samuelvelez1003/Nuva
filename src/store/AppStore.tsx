import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { backendEnabled, fetchCurrentPricing, PricingRow, publishPricingRemote, rowToPricing, supabase } from '../lib/supabase';
import { calculateFare, CategoryId, DEFAULT_PRICING, defaultPricingFor, FareBreakdown, PricingConfig } from '../lib/fare';
import { useCountry } from '../lib/country';
import { buildRoute, Pt, routeMetrics, trafficNow } from '../lib/geo';
import { CURRENT_LOCATION, Place, PLACES } from '../data/places';
import { DriverProfile, MATCH_DRIVERS, PASSENGER_NAMES, PaymentId, rng } from '../data/mock';
import { cancelTrip, fetchMyHistory, placeFrom, rateTrip, requestTrip, TripRow } from '../lib/liveTrips';
import { useAuth } from './Auth';
import { useT } from '../i18n';
import { useLocation } from '../lib/location';
import { estimateRoute, fetchRoute } from '../lib/routing';
import type { NavStep } from '../lib/geo';

// ─── Types ────────────────────────────────────────────────────────────────

export type RidePhase = 'quote' | 'matching' | 'assigned' | 'arriving' | 'in-trip' | 'completed' | 'rated' | 'cancelled';

export interface Ride {
  id: string;
  pickup: Place;
  destination: Place;
  route: Pt[];
  distanceKm: number;
  durationMin: number;
  category: CategoryId;
  /** Snapshot taken when the ride is requested — later price edits don't touch it. */
  fare?: FareBreakdown;
  payment: PaymentId;
  driver?: DriverProfile;
  phase: RidePhase;
  requestedAt?: Date;
  completedAt?: Date;
  rating?: number;
  tip?: number;
  /** Set when the ride exists on the server (live mode). */
  tripId?: string;
  tripCode?: string;
  /** Live driver position from driver_presence. */
  driverPos?: { lat: number; lng: number; heading: number };
  /** Driver's Nequi (only shared for Nequi payments, once underway). */
  driverNequi?: string | null;
  startedAt?: Date;
  paymentChannel?: 'direct' | 'platform';
  /** Turn-by-turn steps from the routing service, when available. */
  steps?: NavStep[];
}

export interface PassengerTrip {
  id: string;
  from: Place;
  to: Place;
  date: Date;
  fare: FareBreakdown;
  driverName: string;
  car: string;
  payment: PaymentId;
  rating?: number;
  status: 'completado' | 'cancelado';
}

export interface DriverTrip {
  id: string;
  passenger: string;
  from: Place;
  to: Place;
  date: Date;
  fare: FareBreakdown;
  rating?: number;
  bonus?: number;
}

export interface Withdrawal {
  id: string;
  amount: number;
  destination: string;
  date: Date;
  status: 'procesando' | 'completado';
}

// ─── Mock history (fares computed with the engine, never hard-coded) ──────

const ALL_PLACES = [CURRENT_LOCATION, ...PLACES];

function tripBetween(from: Place, to: Place, category: CategoryId, config: PricingConfig) {
  const route = buildRoute(from, to);
  const m = routeMetrics(route);
  return calculateFare(m, config, category);
}

function seedPassengerTrips(): PassengerTrip[] {
  const r = rng(31);
  const now = Date.now();
  const cats: CategoryId[] = ['go', 'go', 'eco', 'confort', 'moto', 'go'];
  return Array.from({ length: 12 }, (_, i) => {
    let from = ALL_PLACES[Math.floor(r() * ALL_PLACES.length)];
    let to = ALL_PLACES[Math.floor(r() * ALL_PLACES.length)];
    if (to.id === from.id) to = PLACES[(PLACES.indexOf(from as Place) + 3) % PLACES.length];
    if (i === 0) {
      from = PLACES[1];
      to = PLACES[0];
    }
    const driver = MATCH_DRIVERS[i % MATCH_DRIVERS.length];
    const category = cats[i % cats.length];
    return {
      id: `NV-${(784120 - i * 37).toString()}`,
      from,
      to,
      date: new Date(now - (i * 1.7 + 0.6) * 86_400_000 - r() * 4 * 3_600_000),
      fare: tripBetween(from, to, category, DEFAULT_PRICING),
      driverName: driver.name.split(' ').slice(0, 2).join(' '),
      car: `${driver.car} · ${driver.plate}`,
      payment: i % 3 === 0 ? 'cash' : i % 3 === 1 ? 'nequi' : 'bancolombia',
      rating: i === 4 ? undefined : 5 - (i % 5 === 3 ? 1 : 0),
      status: i === 6 ? 'cancelado' : 'completado',
    };
  });
}

function seedDriverTrips(): DriverTrip[] {
  const r = rng(404);
  const out: DriverTrip[] = [];
  const now = new Date();
  const cats: CategoryId[] = ['go', 'go', 'go', 'confort', 'eco'];
  for (let day = 0; day < 35; day++) {
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    // Today: only trips that already happened; past days: a full shift.
    const count = day === 0 ? 7 : 9 + Math.floor(r() * 8);
    if (day > 0 && base.getDay() === 0 && r() > 0.4) continue; // some Sundays off
    let t = day === 0 ? now.getTime() - 22 * 60_000 : base.getTime() + 20.5 * 3_600_000;
    for (let i = 0; i < count; i++) {
      const from = ALL_PLACES[Math.floor(r() * ALL_PLACES.length)];
      let to = ALL_PLACES[Math.floor(r() * ALL_PLACES.length)];
      if (to.id === from.id) to = PLACES[(PLACES.indexOf(from as Place) + 5) % PLACES.length] ?? PLACES[2];
      const fare = tripBetween(from, to, cats[Math.floor(r() * cats.length)], DEFAULT_PRICING);
      out.push({
        id: `DT-${day}-${i}`,
        passenger: PASSENGER_NAMES[Math.floor(r() * PASSENGER_NAMES.length)],
        from,
        to,
        date: new Date(t),
        fare,
        rating: r() > 0.25 ? (r() > 0.12 ? 5 : 4) : undefined,
      });
      t -= (fare.durationMin + 8 + r() * 22) * 60_000;
    }
  }
  return out.sort((a, b) => b.date.getTime() - a.date.getTime());
}

// ─── Context ──────────────────────────────────────────────────────────────

interface Store {
  pricing: PricingConfig;
  pricingVersion: number;
  /** Resolves with the new version number; throws if the backend rejects it. */
  publishPricing: (c: PricingConfig, note?: string) => Promise<number>;

  // Passenger
  passengerAuthed: boolean;
  phone: string;
  setPhone: (p: string) => void;
  signIn: () => void;
  signOut: () => void;
  payment: PaymentId;
  setPayment: (p: PaymentId) => void;
  passengerTrips: PassengerTrip[];
  ride: Ride | null;
  startQuote: (destination: Place, pickup?: Place) => void;
  setPickup: (p: Place) => void;
  setCategory: (c: CategoryId) => void;
  /** Live mode: creates the trip on the server (throws on error). Demo mode: local. */
  requestRide: () => Promise<void>;
  setRidePhase: (p: RidePhase) => void;
  patchRide: (patch: Partial<Ride>) => void;
  assignDriver: () => void;
  completeRide: () => void;
  rateRide: (stars: number, tip: number) => void;
  /**
   * Cancels on the server first (throws if it refuses or the network fails, leaving the
   * ride as is). keepQuote: back to the quote instead of closing the ride.
   */
  cancelRide: (o?: { keepQuote?: boolean }) => Promise<void>;
  clearRide: () => void;
  /** Rebuilds the ride screen from a server trip still in progress (app reopened). */
  resumeRide: (t: TripRow) => void;

  /** Live mode: re-reads the signed-in user's trip history from the server. */
  reloadHistory: () => void;

  // Driver
  driverOnline: boolean;
  setDriverOnline: (v: boolean) => void;
  driverTrips: DriverTrip[];
  addDriverTrip: (t: DriverTrip) => void;
  withdrawals: Withdrawal[];
  withdraw: (amount: number, destination: string) => void;
  driverOnboarded: boolean;
  setDriverOnboarded: (v: boolean) => void;
}

const Ctx = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const t = useT();
  const location = useLocation();
  const { code: countryCode } = useCountry();
  // Launch defaults of this country until the published version loads.
  const [pricing, setPricing] = useState<PricingConfig>(() => defaultPricingFor(countryCode));
  const [pricingVersion, setPricingVersion] = useState(1);
  const versionRef = useRef(1);
  versionRef.current = pricingVersion;

  const [passengerAuthed, setAuthed] = useState(false);
  const [phone, setPhone] = useState('');
  // Default payment: the country's first digital method (Nequi in Colombia), cash in Curaçao.
  const defaultPayment: PaymentId = countryCode === 'CW' ? 'cash' : 'nequi';
  const [payment, setPayment] = useState<PaymentId>(defaultPayment);
  const [passengerTrips, setPassengerTrips] = useState<PassengerTrip[]>(seedPassengerTrips);
  const [ride, setRide] = useState<Ride | null>(null);

  const [driverOnline, setDriverOnline] = useState(false);
  const [driverTrips, setDriverTrips] = useState<DriverTrip[]>(seedDriverTrips);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>(() => [
    { id: 'w2', amount: 640_000, destination: 'Nequi •• 7719', date: new Date(Date.now() - 3 * 86_400_000), status: 'completado' },
    { id: 'w1', amount: 1_120_000, destination: 'Bancolombia •• 4821', date: new Date(Date.now() - 10 * 86_400_000), status: 'completado' },
  ]);
  const [driverOnboarded, setDriverOnboarded] = useState(true);

  // Live mode: history comes from the server — never the demo samples.
  const uid = auth.live ? auth.session?.user.id : undefined;
  const role = auth.profile?.role;
  const reloadHistory = useCallback(() => {
    if (!uid) return;
    const tripDate = (t: TripRow) => new Date(t.completed_at ?? t.requested_at);
    // An admin can test both apps, so they get both histories.
    if (role === 'driver' || role === 'admin') {
      fetchMyHistory('driver', uid)
        .then((rows) =>
          setDriverTrips(
            rows.map((t) => ({ id: t.code, passenger: 'Pasajero NÜVA', from: placeFrom(t.pickup, `pk-${t.id}`), to: placeFrom(t.destination, `dst-${t.id}`), date: tripDate(t), fare: t.fare, rating: t.rating ?? undefined })),
          ),
        )
        .catch(() => {});
    }
    if (role !== 'driver') {
      fetchMyHistory('passenger', uid)
        .then((rows) =>
          setPassengerTrips(
            rows.map((t) => ({
              id: t.code,
              from: placeFrom(t.pickup, `pk-${t.id}`),
              to: placeFrom(t.destination, `dst-${t.id}`),
              date: tripDate(t),
              fare: t.fare,
              driverName: 'Conductor NÜVA',
              car: '',
              payment: (t.payment as PaymentId) ?? 'cash',
              rating: t.rating ?? undefined,
              status: t.status === 'completed' ? 'completado' : 'cancelado',
            })),
          ),
        )
        .catch(() => {});
    }
  }, [uid, role]);

  useEffect(() => {
    if (!uid) return;
    setPassengerTrips([]);
    setDriverTrips([]);
    setWithdrawals([]);
    reloadHistory();
  }, [uid, reloadHistory]);

  // With a backend, the latest published version is the source of truth and
  // every device follows new versions live through Supabase Realtime.
  // Rates are per country: only this country's versions apply here.
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    fetchCurrentPricing(countryCode).then((p) => {
      if (alive && p) {
        setPricing(p.config);
        setPricingVersion(p.version);
      }
    });
    const channel = supabase
      .channel(`pricing-${countryCode}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pricing_versions', filter: `country=eq.${countryCode}` }, (payload) => {
        const row = payload.new as PricingRow;
        if ((row.country ?? 'CO') !== countryCode) return;
        setPricing(rowToPricing(row));
        setPricingVersion(row.version);
      })
      .subscribe();
    return () => {
      alive = false;
      supabase?.removeChannel(channel);
    };
  }, [countryCode]);

  const publishPricing = useCallback(async (c: PricingConfig, note?: string) => {
    if (backendEnabled) {
      const v = await publishPricingRemote(c, countryCode, note);
      setPricing(c);
      setPricingVersion(v);
      return v;
    }
    const next = versionRef.current + 1;
    setPricing(c);
    setPricingVersion(next);
    return next;
  }, [countryCode]);

  // Real street route (OSRM) replaces the instant estimate as soon as it arrives.
  const refineRoute = useCallback((rideId: string, pickup: Place, destination: Place) => {
    fetchRoute(pickup, destination).then((r) => {
      if (r.source !== 'osrm') return;
      setRide((cur) =>
        cur && cur.id === rideId && cur.phase === 'quote' && cur.pickup.lat === pickup.lat && cur.destination.lat === destination.lat
          ? { ...cur, route: r.points, distanceKm: r.distanceKm, durationMin: r.durationMin, steps: r.steps }
          : cur,
      );
    });
  }, []);

  const startQuote = useCallback(
    (destination: Place, pickup?: Place) => {
      // A trip already requested or under way is never replaced by a new quote: the
      // callers then open the ride screen, which shows that trip.
      const cur = rideRef.current;
      if (cur && cur.phase !== 'quote' && cur.phase !== 'rated' && cur.phase !== 'completed') return;
      const from = pickup ?? location.here;
      const est = estimateRoute(from, destination);
      const id = `NV-${Math.floor(784200 + Math.random() * 9000)}`;
      setRide({
        id,
        pickup: from,
        destination,
        route: est.points,
        distanceKm: est.distanceKm,
        durationMin: est.durationMin,
        category: 'go',
        payment: defaultPayment,
        phase: 'quote',
      });
      refineRoute(id, from, destination);
    },
    [location.here, refineRoute],
  );

  const setPickup = useCallback(
    (pickup: Place) => {
      setRide((r) => {
        if (!r) return r;
        const est = estimateRoute(pickup, r.destination);
        refineRoute(r.id, pickup, r.destination);
        return { ...r, pickup, route: est.points, distanceKm: est.distanceKm, durationMin: est.durationMin, steps: undefined };
      });
    },
    [refineRoute],
  );

  const setCategory = useCallback((category: CategoryId) => setRide((r) => (r ? { ...r, category } : r)), []);

  const rideRef = useRef(ride);
  rideRef.current = ride;

  const requestRide = useCallback(async () => {
    const r = rideRef.current;
    if (!r) return;
    // With the backend on, a ride is always a real server trip — never a simulated driver.
    if (auth.live && !auth.session) throw new Error(t('pax.ride.signInFirst'));
    if (auth.live && auth.session) {
      // The server prices the trip with the live pricing version.
      const t = await requestTrip({ pickup: r.pickup, destination: r.destination, category: r.category, payment, distanceKm: r.distanceKm, durationMin: r.durationMin });
      setRide((cur) =>
        cur
          ? {
              ...cur,
              payment,
              tripId: t.id,
              tripCode: t.code,
              fare: t.fare,
              distanceKm: Number(t.distance_km),
              durationMin: t.duration_min,
              paymentChannel: t.payment_channel,
              phase: 'matching',
              requestedAt: new Date(),
            }
          : cur,
      );
      return;
    }
    setRide((cur) =>
      cur
        ? {
            ...cur,
            payment,
            fare: calculateFare(cur, pricing, cur.category),
            phase: 'matching',
            requestedAt: new Date(),
          }
        : cur,
    );
  }, [payment, pricing, auth.live, auth.session, t]);

  const setRidePhase = useCallback((phase: RidePhase) => setRide((r) => (r ? { ...r, phase } : r)), []);
  const patchRide = useCallback((patch: Partial<Ride>) => setRide((r) => (r ? { ...r, ...patch } : r)), []);

  const assignDriver = useCallback(() => {
    setRide((r) => (r ? { ...r, driver: MATCH_DRIVERS[Math.floor(Math.random() * MATCH_DRIVERS.length)], phase: 'assigned' } : r));
  }, []);

  const completeRide = useCallback(() => {
    setRide((r) => {
      // Rating and payment confirmation also update the trip row (another "completed"
      // event): never send a rated ride back to the rating form.
      if (!r || !r.fare || r.phase === 'completed' || r.phase === 'rated') return r;
      const done: Ride = { ...r, phase: 'completed', completedAt: new Date() };
      setPassengerTrips((list) => [
        {
          id: r.id,
          from: r.pickup,
          to: r.destination,
          date: new Date(),
          fare: r.fare!,
          driverName: r.driver?.name.split(' ').slice(0, 2).join(' ') ?? 'Conductor NÜVA',
          car: r.driver ? `${r.driver.car} · ${r.driver.plate}` : '',
          payment: r.payment,
          status: 'completado',
        },
        ...list.filter((t) => t.id !== r.id),
      ]);
      return done;
    });
  }, []);

  const rateRide = useCallback((stars: number, tip: number) => {
    const tripId = rideRef.current?.tripId;
    if (tripId) rateTrip(tripId, stars, tip).catch(() => {});
    setRide((r) => {
      if (!r) return r;
      setPassengerTrips((list) => list.map((t) => (t.id === r.id ? { ...t, rating: stars } : t)));
      return { ...r, rating: stars, tip, phase: 'rated' };
    });
  }, []);

  const cancelRide = useCallback(async (o?: { keepQuote?: boolean }) => {
    const tripId = rideRef.current?.tripId;
    if (tripId) await cancelTrip(tripId);
    if (o?.keepQuote) setRide((r) => (r ? { ...r, phase: 'quote', tripId: undefined, tripCode: undefined, driver: undefined, driverPos: undefined } : r));
    else setRide(null);
  }, []);
  const clearRide = useCallback(() => setRide(null), []);

  const resumeRide = useCallback((t: TripRow) => {
    const pickup = placeFrom(t.pickup, `pk-${t.id}`);
    const destination = placeFrom(t.destination, `dst-${t.id}`);
    const est = estimateRoute(pickup, destination);
    setRide({
      id: t.code,
      tripId: t.id,
      tripCode: t.code,
      pickup,
      destination,
      route: est.points,
      distanceKm: Number(t.distance_km),
      durationMin: t.duration_min,
      category: t.category,
      payment: (t.payment as PaymentId) ?? 'cash',
      fare: t.fare,
      paymentChannel: t.payment_channel,
      phase: t.status === 'requested' ? 'matching' : t.status === 'accepted' ? 'assigned' : t.status === 'arriving' ? 'arriving' : 'in-trip',
      requestedAt: new Date(t.requested_at),
      startedAt: t.started_at ? new Date(t.started_at) : undefined,
    });
    // The ride screen then reads the driver, PIN and live position from the server.
    fetchRoute(pickup, destination).then((r) => {
      if (r.source === 'osrm') setRide((cur) => (cur && cur.tripId === t.id ? { ...cur, route: r.points, steps: r.steps } : cur));
    });
  }, []);

  const addDriverTrip = useCallback((t: DriverTrip) => setDriverTrips((list) => [t, ...list]), []);

  const withdraw = useCallback((amount: number, destination: string) => {
    setWithdrawals((list) => [
      { id: `w${Date.now()}`, amount, destination, date: new Date(), status: 'procesando' },
      ...list,
    ]);
  }, []);

  const value = useMemo<Store>(
    () => ({
      pricing,
      pricingVersion,
      publishPricing,
      passengerAuthed,
      phone,
      setPhone,
      signIn: () => setAuthed(true),
      signOut: () => setAuthed(false),
      payment,
      setPayment,
      passengerTrips,
      ride,
      startQuote,
      setPickup,
      setCategory,
      requestRide,
      setRidePhase,
      patchRide,
      assignDriver,
      completeRide,
      rateRide,
      cancelRide,
      clearRide,
      resumeRide,
      reloadHistory,
      driverOnline,
      setDriverOnline,
      driverTrips,
      addDriverTrip,
      withdrawals,
      withdraw,
      driverOnboarded,
      setDriverOnboarded,
    }),
    [
      pricing, pricingVersion, publishPricing, passengerAuthed, phone, payment, passengerTrips, ride, startQuote,
      setPickup, setCategory, requestRide, setRidePhase, patchRide, assignDriver, completeRide, rateRide, cancelRide, clearRide, resumeRide, reloadHistory,
      driverOnline, driverTrips, addDriverTrip, withdrawals, withdraw, driverOnboarded,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStoreProvider');
  return v;
}

// ─── Derived driver figures ───────────────────────────────────────────────

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function sumTrips(trips: DriverTrip[]) {
  let gross = 0;
  let commission = 0;
  let net = 0;
  let minutes = 0;
  let km = 0;
  let bonus = 0;
  for (const t of trips) {
    gross += t.fare.finalFare;
    commission += t.fare.platformCommission;
    net += t.fare.driverEarnings;
    minutes += t.fare.durationMin;
    km += t.fare.distanceKm;
    bonus += t.bonus ?? 0;
  }
  return { count: trips.length, gross, commission, net, minutes, km, bonus };
}

export function tripsSince(trips: DriverTrip[], from: Date, to = new Date(8.64e15)) {
  return trips.filter((t) => t.date >= from && t.date < to);
}

export function todayTrips(trips: DriverTrip[]) {
  return tripsSince(trips, startOfDay(new Date()));
}

/** Monday-based start of the current week. */
export function startOfWeek(d = new Date()) {
  const s = startOfDay(d);
  const dow = (s.getDay() + 6) % 7;
  s.setDate(s.getDate() - dow);
  return s;
}

export function dailySeries(trips: DriverTrip[], days: number, end = new Date()) {
  const out: { date: Date; net: number; gross: number; count: number }[] = [];
  const e = startOfDay(end);
  for (let i = days - 1; i >= 0; i--) {
    const from = new Date(e.getFullYear(), e.getMonth(), e.getDate() - i);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
    const s = sumTrips(tripsSince(trips, from, to));
    out.push({ date: from, net: s.net, gross: s.gross, count: s.count });
  }
  return out;
}

export function weekSeries(trips: DriverTrip[]) {
  const start = startOfWeek();
  return Array.from({ length: 7 }, (_, i) => {
    const from = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
    const s = sumTrips(tripsSince(trips, from, to));
    return { date: from, net: s.net, gross: s.gross, count: s.count, future: from > new Date() };
  });
}

/** Available balance = all net earnings of the last 35 days minus payouts. */
export function availableBalance(trips: DriverTrip[], withdrawals: Withdrawal[]) {
  const recent = tripsSince(trips, new Date(Date.now() - 12 * 86_400_000));
  const s = sumTrips(recent);
  const out = withdrawals.filter((w) => w.date.getTime() > Date.now() - 12 * 86_400_000).reduce((a, w) => a + w.amount, 0);
  return Math.max(0, s.net + s.bonus - out);
}
