import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PaymentId } from '../data/mock';
import type { Place } from '../data/places';
import type { CategoryId, FareBreakdown } from './fare';
import { supabase } from './supabase';

/**
 * Thin client for the live-trip backend (Supabase RPCs + Realtime).
 * Every money figure comes from the server's fare engine.
 */

export type TripStatus = 'requested' | 'accepted' | 'arriving' | 'in_progress' | 'completed' | 'cancelled';

export interface TripPlace {
  name: string;
  address?: string;
  area?: string;
  lat: number;
  lng: number;
}

export interface TripRow {
  id: string;
  code: string;
  passenger_id: string;
  driver_id: string | null;
  status: TripStatus;
  category: CategoryId;
  payment: string;
  payment_channel: 'direct' | 'platform';
  payment_status: 'pendiente' | 'pagado' | 'fallido';
  pickup: TripPlace;
  destination: TripPlace;
  distance_km: number;
  duration_min: number;
  pricing_version: number;
  fare: FareBreakdown & { version: number };
  final_fare: number;
  platform_commission: number;
  driver_earnings: number;
  requested_at: string;
  accepted_at?: string | null;
  started_at?: string | null;
  /** Promo discount in minor units: the passenger pays final_fare − discount; NÜVA credits it to the driver. */
  discount?: number;
  promo_id?: string | null;
  completed_at?: string | null;
  rating?: number | null;
  tip?: number | null;
  paid_at?: string | null;
  country?: string;
  currency?: string;
  /** NÜVA Mujeres: only verified women drivers can see and take it. */
  women_only?: boolean;
  passenger_female?: boolean;
  /** Scheduled pickup time (null = now). */
  scheduled_for?: string | null;
  /** When the request is offered to drivers: now, or 15 min before a scheduled pickup. */
  release_at?: string;
}

export interface Counterpart {
  name: string;
  rating: number;
  role: 'passenger' | 'driver' | 'admin';
  vehicle: { brand?: string; model?: string; plate?: string; color?: string } | null;
  nequi: string | null;
  /** Where to pay for the chosen method (Nequi, bank account…), once the trip is underway. */
  payAccount?: string | null;
  avatar?: string | null;
  /** Only while the trip is active (accepted → in progress); null afterwards. */
  phone?: string | null;
  /** Driver: when their selfie identity check was done (null if not within the required hours). */
  identityCheckedAt?: string | null;
  /** Driver verified by NÜVA as a woman (NÜVA Mujeres). */
  womenVerified?: boolean;
}

export interface TripMessage {
  id: string;
  trip_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface Presence {
  driver_id: string;
  online: boolean;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  updated_at: string;
}

const db = () => {
  if (!supabase) throw new Error('Backend no configurado');
  return supabase;
};

const fail = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};

/** App payment ids → server payment codes (direct vs platform is decided server-side). */
export const SERVER_PAYMENT: Record<PaymentId, string> = {
  cash: 'cash',
  nequi: 'nequi',
  daviplata: 'daviplata',
  bancolombia: 'bancolombia',
  card: 'card',
};

export const toTripPlace = (p: Place): TripPlace => ({ name: p.name, address: p.address, area: p.area, lat: p.lat, lng: p.lng });

// ─── Passenger ─────────────────────────────────────────────────────────────

export async function requestTrip(args: {
  pickup: Place;
  destination: Place;
  category: CategoryId;
  payment: PaymentId;
  distanceKm: number;
  durationMin: number;
  promoCode?: string;
  /** NÜVA Mujeres: a verified woman driver (passenger's profile must say she's a woman). */
  womenOnly?: boolean;
  /** Scheduled trip: 30 min to 7 days ahead. */
  scheduledFor?: Date | null;
}) {
  const { data, error } = await db().rpc('request_ride', {
    p_pickup: toTripPlace(args.pickup),
    p_destination: toTripPlace(args.destination),
    p_category: args.category,
    p_payment: SERVER_PAYMENT[args.payment],
    p_distance_km: args.distanceKm,
    p_duration_min: args.durationMin,
    p_promo_code: args.promoCode ?? null,
    p_women_only: !!args.womenOnly,
    p_scheduled_for: args.scheduledFor ? args.scheduledFor.toISOString() : null,
  });
  fail(error);
  return data as TripRow;
}

/** The passenger's scheduled trips that haven't been offered to drivers yet, soonest first. */
export async function fetchScheduledTrips(userId: string) {
  const { data, error } = await db()
    .from('trips')
    .select('*')
    .eq('passenger_id', userId)
    .eq('status', 'requested')
    .not('scheduled_for', 'is', null)
    .gt('release_at', new Date().toISOString())
    .order('scheduled_for')
    .limit(5);
  fail(error);
  return (data as TripRow[]) ?? [];
}

/** A card trip whose card failed: pay the driver directly instead. */
export async function switchTripPayment(id: string, payment: Exclude<PaymentId, 'card'>) {
  const { data, error } = await db().rpc('switch_trip_payment', { p_trip: id, p_payment: SERVER_PAYMENT[payment] });
  fail(error);
  return data as TripRow;
}

/** Token of the public link that shows this trip live (passenger only, while it's on). */
export async function shareTrip(id: string) {
  const { data, error } = await db().rpc('share_trip', { p_trip: id });
  fail(error);
  return data as string;
}

/** What a shared-trip link shows (public, no session needed). Null once it expired. */
export interface SharedTrip {
  code: string;
  status: TripStatus;
  pickup: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
  passenger: string;
  driver: { name: string; rating: number; avatar: string | null; vehicle: { brand?: string; model?: string; color?: string; plate?: string } } | null;
  position: { lat: number; lng: number; heading: number | null; at: string } | null;
  requestedAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  durationMin: number;
  distanceKm: number;
}

export async function fetchSharedTrip(token: string) {
  const { data, error } = await db().rpc('shared_trip', { p_token: token });
  fail(error);
  return (data as SharedTrip | null) ?? null;
}

export interface PromoCheck {
  ok: boolean;
  code?: string;
  title?: string;
  /** Minor units off the fare (server-computed; the server re-checks when requesting). */
  discount?: number;
  error?: string;
}

/** Validates a promo code for the signed-in passenger against a fare. */
export async function checkPromo(code: string, fare: number): Promise<PromoCheck> {
  const { data, error } = await db().rpc('check_promo', { p_code: code, p_fare: fare });
  fail(error);
  return data as PromoCheck;
}

export async function cancelTrip(id: string) {
  const { error } = await db().rpc('cancel_ride', { p_trip: id });
  fail(error);
}

export async function rateTrip(id: string, stars: number, tip: number, tags?: string[], note?: string) {
  const { error } = await db().rpc('rate_trip', { p_trip: id, p_rating: stars, p_tip: tip, p_tags: tags?.length ? tags : null, p_note: note?.trim() || null });
  fail(error);
}

// ─── Trip chat (passenger ↔ driver, only while the trip is active) ──────────

export async function fetchMessages(tripId: string) {
  const { data, error } = await db().from('trip_messages').select('*').eq('trip_id', tripId).order('created_at').limit(200);
  fail(error);
  return (data as TripMessage[]) ?? [];
}

export async function sendMessage(tripId: string, body: string) {
  const { error } = await db().from('trip_messages').insert({ trip_id: tripId, body: body.trim().slice(0, 500) });
  fail(error);
}

export function watchMessages(tripId: string, cb: (m: TripMessage) => void): () => void {
  const ch = db()
    .channel(`chat-${tripId}-${uniq()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `trip_id=eq.${tripId}` }, (p) => cb(p.new as TripMessage))
    .subscribe();
  return () => {
    db().removeChannel(ch);
  };
}

/** Opens a support case the admin sees in Soporte (RLS: created_by = the user). */
export type TicketKind = 'general' | 'apelacion' | 'seguridad' | 'pago';

export async function openTicket(subject: string, body?: string, tripId?: string, kind: TicketKind = 'general'): Promise<string> {
  const { data, error } = await db().from('support_tickets').insert({ subject, body: body ?? null, trip_id: tripId ?? null, kind }).select('id').single();
  fail(error);
  /** Short case number shown to the user, e.g. "TK-3F9A2C". */
  return `TK-${String((data as { id: string }).id).slice(0, 6).toUpperCase()}`;
}

export async function fetchCounterpart(id: string) {
  const { data, error } = await db().rpc('trip_counterpart', { p_trip: id });
  fail(error);
  return data as Counterpart | null;
}

export async function fetchMyActiveTrip(role: 'passenger' | 'driver', userId: string) {
  const col = role === 'passenger' ? 'passenger_id' : 'driver_id';
  const { data } = await db()
    .from('trips')
    .select('*')
    .eq(col, userId)
    .in('status', ['requested', 'accepted', 'arriving', 'in_progress'])
    // A scheduled trip becomes the active one when it's offered to drivers.
    .lte('release_at', new Date().toISOString())
    .order('requested_at', { ascending: false })
    .limit(1);
  return ((data as TripRow[]) ?? [])[0] ?? null;
}

/**
 * Realtime hands back an existing channel when the name repeats, and adding
 * listeners to it after subscribe() throws — so every subscription gets its own name.
 */
const uniq = () => Math.random().toString(36).slice(2, 10);

/** Thrown by advanceTrip when the boarding PIN is wrong; screens show their translated text. */
export const PIN_WRONG = 'PIN_WRONG';

/**
 * While a trip is on, the ride screen is the only one sharing the driver's position;
 * the dashboard heartbeat underneath checks this and steps aside.
 */
export const presenceOwner = { ride: false };

/** Calls back with the full row on every change of one trip. */
export function watchTrip(id: string, cb: (t: TripRow) => void): () => void {
  const ch: RealtimeChannel = db()
    .channel(`trip-${id}-${uniq()}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${id}` }, (p) => cb(p.new as TripRow))
    .subscribe();
  return () => {
    db().removeChannel(ch);
  };
}

export function watchPresence(driverId: string, cb: (p: Presence) => void): () => void {
  const ch = db()
    .channel(`presence-${driverId}-${uniq()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_presence', filter: `driver_id=eq.${driverId}` }, (p) => cb(p.new as Presence))
    .subscribe();
  return () => {
    db().removeChannel(ch);
  };
}

// ─── Driver ────────────────────────────────────────────────────────────────

export async function setPresence(driverId: string, online: boolean, pos?: { lat: number; lng: number; heading?: number }) {
  const { error } = await db()
    .from('driver_presence')
    .upsert({ driver_id: driverId, online, lat: pos?.lat ?? null, lng: pos?.lng ?? null, heading: pos?.heading ?? null, updated_at: new Date().toISOString() });
  fail(error);
}

/**
 * Open requests in the driver's own country (the server also refuses cross-country accepts).
 * RLS only returns what this driver may take: released (scheduled trips 15 min before
 * pickup), NÜVA Mujeres only for verified women drivers. A scheduled trip is released
 * without any row change, so callers also poll this list.
 */
export async function listOpenRequests(country: string) {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data, error } = await db().from('trips').select('*').eq('status', 'requested').eq('country', country).gte('release_at', since).order('release_at', { ascending: false }).limit(10);
  fail(error);
  return (data as TripRow[]) ?? [];
}

/** New and updated open requests, for approved drivers (RLS filters the rest). */
export function watchOpenRequests(cb: (t: TripRow, event: 'INSERT' | 'UPDATE') => void): () => void {
  const ch = db()
    .channel(`open-requests-${uniq()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trips' }, (p) => cb(p.new as TripRow, 'INSERT'))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips' }, (p) => cb(p.new as TripRow, 'UPDATE'))
    .subscribe();
  return () => {
    db().removeChannel(ch);
  };
}

export async function acceptTrip(id: string) {
  const { data, error } = await db().rpc('accept_ride', { p_trip: id });
  fail(error);
  return data as TripRow;
}

/** Starting the trip ('in_progress') requires the passenger's boarding PIN. */
export async function advanceTrip(id: string, status: 'arriving' | 'in_progress' | 'completed', pin?: string) {
  const { data, error } = await db().rpc('advance_ride', { p_trip: id, p_status: status, ...(pin ? { p_pin: pin } : {}) });
  fail(error);
  // The server answers an empty row (and counts the attempt) when the PIN is wrong.
  if (!data || !(data as TripRow).id) throw new Error(PIN_WRONG);
  return data as TripRow;
}

/** The passenger's own boarding PIN (the driver can't read it). */
export async function fetchMyPin(id: string) {
  const { data, error } = await db().rpc('my_trip_pin', { p_trip: id });
  fail(error);
  return (data as string | null) ?? null;
}

export async function confirmDirectPayment(id: string) {
  const { error } = await db().rpc('confirm_direct_payment', { p_trip: id });
  fail(error);
}

/** Server totals of this driver's completed trips over the last `days` local days. */
export interface DriverSummary {
  trips: number;
  gross: number;
  /** Commission actually deducted (free trips and test wallets count 0). */
  commission: number;
  tips: number;
  /** Night/airport surcharges collected: 100 % the driver's. */
  surcharges: number;
  /** Paid waiting at pickups and cancellation compensations (100 % the driver's). */
  waits: number;
  cancelFees: number;
  /** Trips that paid no commission (a new driver's first ones, or with the weekly pass). */
  freeTrips: number;
  /** gross − commission + tips. */
  net: number;
}

export async function fetchDriverSummary(days = 1) {
  const { data } = await db().rpc('driver_summary', { p_days: days });
  return (data as DriverSummary) ?? null;
}

export async function fetchDriverBalance() {
  const { data } = await db().rpc('driver_balance');
  return (data as number) ?? 0;
}

/** The signed-in user's finished trips (completed or cancelled), newest first. */
export async function fetchMyHistory(role: 'passenger' | 'driver', userId: string) {
  const col = role === 'passenger' ? 'passenger_id' : 'driver_id';
  const { data, error } = await db()
    .from('trips')
    .select('*')
    .eq(col, userId)
    .in('status', role === 'driver' ? ['completed'] : ['completed', 'cancelled'])
    .order('requested_at', { ascending: false })
    .limit(300);
  fail(error);
  return (data as TripRow[]) ?? [];
}

export async function fetchTrip(id: string) {
  const { data, error } = await db().from('trips').select('*').eq('id', id).single();
  fail(error);
  return data as TripRow;
}

/** Shape a server trip as an app Place. */
export const placeFrom = (p: TripPlace, id: string): Place => ({
  id,
  kind: 'poi',
  name: p.name,
  address: p.address ?? p.name,
  area: p.area ?? '',
  lat: p.lat,
  lng: p.lng,
});
