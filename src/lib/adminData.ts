import { useCallback, useEffect, useState } from 'react';
import type { TripRow } from './liveTrips';
import { supabase } from './supabase';
import { COUNTRIES } from './countries';
import { activeCountry } from './region';

/**
 * Admin console data — straight from Supabase (RLS lets admins read
 * everything). No mock data: empty tables mean empty screens.
 */

export interface AdminProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: 'passenger' | 'driver' | 'admin';
  driver_status: 'pendiente' | 'aprobado' | 'suspendido' | null;
  created_at: string;
}

export interface AdminPresence {
  driver_id: string;
  online: boolean;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  updated_at: string;
}

export interface ZoneRow {
  id: string;
  name: string;
  status: 'activa' | 'piloto' | 'pausada';
  center: { lat: number; lng: number };
  radius_m: number;
}

export interface PromoRow {
  id: string;
  code: string;
  title: string;
  discount_pct: number;
  cap: number;
  budget: number;
  status: 'activa' | 'programada' | 'finalizada';
  ends_at: string | null;
  created_at: string;
}

export interface TicketRow {
  id: string;
  created_by: string;
  trip_id: string | null;
  subject: string;
  body: string | null;
  priority: 'alta' | 'media' | 'baja';
  status: 'abierto' | 'en-curso' | 'resuelto';
  created_at: string;
}

function useTable<T>(load: () => Promise<T[]>, realtimeTable?: string) {
  const [rows, setRows] = useState<T[] | null>(null);
  const refresh = useCallback(async () => {
    try {
      setRows(await load());
    } catch {
      setRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    refresh();
    if (!supabase || !realtimeTable) return;
    const ch = supabase
      .channel(`admin-${realtimeTable}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: realtimeTable }, () => refresh())
      .subscribe();
    return () => {
      supabase?.removeChannel(ch);
    };
  }, [refresh, realtimeTable]);
  return { rows, refresh, loading: rows === null };
}

const sb = () => {
  if (!supabase) throw new Error('Backend no configurado');
  return supabase;
};

// Every admin list shows the country selected in the console (the tree remounts on change).
export const useAdminTrips = () =>
  useTable<TripRow>(async () => {
    const { data } = await sb().from('trips').select('*').eq('country', activeCountry()).order('requested_at', { ascending: false }).limit(2000);
    return (data as TripRow[]) ?? [];
  }, 'trips');

export const useAdminProfiles = () =>
  useTable<AdminProfile>(async () => {
    const { data } = await sb()
      .from('profiles')
      .select('id, email, full_name, phone, role, driver_status, created_at, country')
      .eq('country', activeCountry())
      .order('created_at', { ascending: false });
    return (data as AdminProfile[]) ?? [];
  });

export const useAdminPresence = () =>
  useTable<AdminPresence>(async () => {
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data } = await sb().from('driver_presence').select('*').eq('online', true).gte('updated_at', since);
    // Presence has no country: keep drivers whose position is inside the selected country.
    const b = COUNTRIES[activeCountry()].bounds;
    return ((data as AdminPresence[]) ?? []).filter((p) => p.lat != null && p.lng != null && p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng);
  }, 'driver_presence');

export const useZones = () =>
  useTable<ZoneRow>(async () => {
    const { data } = await sb().from('zones').select('*').eq('country', activeCountry()).order('name');
    return (data as ZoneRow[]) ?? [];
  });

export const usePromos = () =>
  useTable<PromoRow>(async () => {
    const { data } = await sb().from('promos').select('*').order('created_at', { ascending: false });
    return (data as PromoRow[]) ?? [];
  });

export const useTickets = () =>
  useTable<TicketRow>(async () => {
    const { data } = await sb().from('support_tickets').select('*').order('created_at', { ascending: false });
    return (data as TicketRow[]) ?? [];
  }, 'support_tickets');

// ─── Aggregations ──────────────────────────────────────────────────────────

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function dailyTotals(trips: TripRow[], days: number) {
  const out: { date: Date; trips: number; volume: number; commission: number; cancellations: number }[] = [];
  const now = new Date();
  const index = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    index.set(dayKey(d), out.length);
    out.push({ date: d, trips: 0, volume: 0, commission: 0, cancellations: 0 });
  }
  for (const t of trips) {
    const when = new Date(t.status === 'completed' ? ((t as TripRow & { completed_at?: string }).completed_at ?? t.requested_at) : t.requested_at);
    const i = index.get(dayKey(when));
    if (i === undefined) continue;
    if (t.status === 'completed') {
      out[i].trips += 1;
      out[i].volume += t.final_fare;
      out[i].commission += t.platform_commission;
    } else if (t.status === 'cancelled') out[i].cancellations += 1;
  }
  return out;
}

export function monthlyTotals(trips: TripRow[], months = 12) {
  const now = new Date();
  const out = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return { month: d.getMonth(), year: d.getFullYear(), trips: 0, volume: 0, commission: 0 };
  });
  for (const t of trips) {
    if (t.status !== 'completed') continue;
    const d = new Date((t as TripRow & { completed_at?: string }).completed_at ?? t.requested_at);
    const m = out.find((x) => x.month === d.getMonth() && x.year === d.getFullYear());
    if (m) {
      m.trips += 1;
      m.volume += t.final_fare;
      m.commission += t.platform_commission;
    }
  }
  return out;
}

export const ACTIVE_STATUSES = ['requested', 'accepted', 'arriving', 'in_progress'] as const;
