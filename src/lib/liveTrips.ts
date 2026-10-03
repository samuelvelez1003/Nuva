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
  completed_at?: string | null;
  rating?: number | null;
  country?: 'CO' | 'CW';
  currency?: 'COP' | 'XCG';
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
  transfer: 'transfer',
  card: 'card',
};

export const toTripPlace = (p: Place): TripPlace => ({ name: p.name, address: p.address, area: p.area, lat: p.lat, lng: p.lng });

// ─── Passenger ─────────────────────────────────────────────────────────────

export async function requestTrip(args: { pickup: Place; destination: Place; category: CategoryId; payment: PaymentId; distanceKm: number; durationMin: number }) {
  const { data, error } = await db().rpc('request_ride', {
    p_pickup: toTripPlace(args.pickup),
    p_destination: toTripPlace(args.destination),
    p_category: args.category,
    p_payment: SERVER_PAYMENT[args.payment],
    p_distance_km: args.distanceKm,
    p_duration_min: args.durationMin,
  });
  fail(error);
  return data as TripRow;
}

export async function cancelTrip(id: string) {
  const { error } = await db().rpc('cancel_ride', { p_trip: id });
  fail(error);
}

export async function rateTrip(id: string, stars: number, tip: number) {
  const { error } = await db().rpc('rate_trip', { p_trip: id, p_rating: stars, p_tip: tip });
  fail(error);
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
    .order('requested_at', { ascending: false })
    .limit(1);
  return ((data as TripRow[]) ?? [])[0] ?? null;
}

/** Calls back with the full row on every change of one trip. */
export function watchTrip(id: string, cb: (t: TripRow) => void): () => void {
  const ch: RealtimeChannel = db()
    .channel(`trip-${id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${id}` }, (p) => cb(p.new as TripRow))
    .subscribe();
  return () => {
    db().removeChannel(ch);
  };
}

export function watchPresence(driverId: string, cb: (p: Presence) => void): () => void {
  const ch = db()
    .channel(`presence-${driverId}`)
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

/** Open requests in the driver's own country (the server also refuses cross-country accepts). */
export async function listOpenRequests(country: string) {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data, error } = await db().from('trips').select('*').eq('status', 'requested').eq('country', country).gte('requested_at', since).order('requested_at', { ascending: false }).limit(10);
  fail(error);
  return (data as TripRow[]) ?? [];
}

/** New and updated open requests, for approved drivers (RLS filters the rest). */
export function watchOpenRequests(cb: (t: TripRow, event: 'INSERT' | 'UPDATE') => void): () => void {
  const ch = db()
    .channel('open-requests')
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
  if (!data || !(data as TripRow).id) throw new Error('PIN incorrecto. Pídeselo de nuevo al pasajero');
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

export async function fetchDriverSummary(days = 1) {
  const { data } = await db().rpc('driver_summary', { p_days: days });
  return (data as { trips: number; gross: number; commission: number; net: number }) ?? null;
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
