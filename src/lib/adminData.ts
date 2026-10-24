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
  /** Founder/test account: commissions never deducted, excluded from finance. */
  test_wallet?: boolean;
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

/** NÜVA's own bank account in one country (drivers transfer there to top up). */
export interface BankAccountRow {
  id: string;
  country: string;
  bank: string;
  account_type: string;
  number: string;
  holder: string;
  holder_id: string;
  note: string;
  active: boolean;
  updated_at: string;
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
  /** Appeals and safety reports get priority 'alta' automatically. */
  kind?: 'general' | 'apelacion' | 'seguridad' | 'pago';
  /** The team's answer, shown to the user in the app. */
  reply?: string | null;
  replied_at?: string | null;
}

/** A driver's withdrawal request (admin_withdrawals). The team pays it by hand. */
export interface WithdrawalRow {
  id: string;
  driverId: string;
  driver: string | null;
  phone: string | null;
  amount: number;
  method: 'nequi' | 'daviplata' | 'bancolombia' | 'banco' | null;
  account: string | null;
  status: 'procesando' | 'completado' | 'rechazado';
  note: string | null;
  createdAt: string;
  processedAt: string | null;
}

/** An identity selfie a driver took before going online (private bucket "selfies"). */
export interface SelfieRow {
  id: string;
  driver_id: string;
  path: string;
  status: 'pendiente' | 'aprobada' | 'rechazada';
  reviewed_at: string | null;
  created_at: string;
}

/**
 * Loads a table and keeps it live.
 * - Each hook instance gets its OWN realtime channel: realtime-js hands back an existing
 *   channel for a repeated name, and adding listeners to it after subscribe() throws
 *   (the Support page and the sidebar both watch tickets).
 * - Bursts of events are coalesced into one reload; `filter` limits events to a country.
 * - `everyMs` re-reads periodically (e.g. presence, which goes stale without events).
 */
function useTable<T>(load: () => Promise<T[]>, realtimeTable?: string, opts?: { filter?: string; everyMs?: number }) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setRows(await load());
      setError(false);
    } catch {
      setError(true);
      setRows((cur) => cur ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    refresh();
    const every = opts?.everyMs ? setInterval(refresh, opts.everyMs) : null;
    if (!supabase || !realtimeTable) {
      return () => {
        if (every) clearInterval(every);
      };
    }
    let pending: ReturnType<typeof setTimeout> | null = null;
    const ch = supabase
      .channel(`admin-${realtimeTable}-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: realtimeTable, ...(opts?.filter ? { filter: opts.filter } : {}) }, () => {
        if (pending) clearTimeout(pending);
        pending = setTimeout(refresh, 400);
      })
      .subscribe();
    return () => {
      if (pending) clearTimeout(pending);
      if (every) clearInterval(every);
      supabase?.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, realtimeTable]);
  return { rows, refresh, loading: rows === null, error };
}

/** Requests nobody accepted in 15 min are dead (drivers stop seeing them): not "active". */
export const STALE_REQUEST_MS = 15 * 60_000;
export const isLiveActive = (t: TripRow) =>
  (ACTIVE_STATUSES as readonly string[]).includes(t.status) && !(t.status === 'requested' && Date.now() - new Date(t.requested_at).getTime() > STALE_REQUEST_MS);

const sb = () => {
  if (!supabase) throw new Error('Backend no configurado');
  return supabase;
};

// Every admin list shows the country selected in the console (the tree remounts on change).
export const useAdminTrips = () =>
  useTable<TripRow>(async () => {
    const { data, error } = await sb().from('trips').select('*').eq('country', activeCountry()).order('requested_at', { ascending: false }).limit(2000);
    if (error) throw error;
    return (data as TripRow[]) ?? [];
  }, 'trips', { filter: `country=eq.${activeCountry()}`, everyMs: 60_000 });

export const useAdminProfiles = () =>
  useTable<AdminProfile>(async () => {
    const { data, error } = await sb()
      .from('profiles')
      .select('id, email, full_name, phone, role, driver_status, created_at, country, test_wallet')
      .eq('country', activeCountry())
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as AdminProfile[]) ?? [];
  }, 'profiles', { filter: `country=eq.${activeCountry()}` });

export const useAdminPresence = () =>
  useTable<AdminPresence>(async () => {
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data, error } = await sb().from('driver_presence').select('*').eq('online', true).gte('updated_at', since);
    if (error) throw error;
    // Presence has no country: keep drivers whose position is inside the selected country.
    const b = COUNTRIES[activeCountry()].bounds;
    return ((data as AdminPresence[]) ?? []).filter((p) => p.lat != null && p.lng != null && p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng);
    // Re-read every 30 s: a driver whose app died sends no event but must drop off the count.
  }, 'driver_presence', { everyMs: 30_000 });

export const useZones = () =>
  useTable<ZoneRow>(async () => {
    const { data } = await sb().from('zones').select('*').eq('country', activeCountry()).order('name');
    return (data as ZoneRow[]) ?? [];
  });

export const usePromos = () =>
  useTable<PromoRow>(async () => {
    const { data } = await sb().from('promos').select('*').eq('country', activeCountry()).order('created_at', { ascending: false });
    return (data as PromoRow[]) ?? [];
  });

export const useBankAccounts = () =>
  useTable<BankAccountRow>(async () => {
    const { data, error } = await sb().from('bank_accounts').select('*').eq('country', activeCountry()).order('created_at');
    if (error) throw error;
    return (data as BankAccountRow[]) ?? [];
  });

export const useTickets = () =>
  useTable<TicketRow>(async () => {
    const { data, error } = await sb().from('support_tickets').select('*').eq('country', activeCountry()).order('created_at', { ascending: false });
    if (error) throw error;
    return (data as TicketRow[]) ?? [];
  }, 'support_tickets', { filter: `country=eq.${activeCountry()}` });

// ─── Driver withdrawals, identity selfies, support replies ─────────────────

/** Withdrawals, pending first (`status` is fixed per hook instance, e.g. 'procesando' for the badge). */
export const useAdminWithdrawals = (status?: WithdrawalRow['status']) =>
  useTable<WithdrawalRow>(async () => {
    const { data, error } = await sb().rpc('admin_withdrawals', { p_status: status ?? null });
    if (error) throw error;
    return (data as WithdrawalRow[]) ?? [];
  }, 'withdrawals', { everyMs: 60_000 });

/** Marks a withdrawal paid (optional reference) or rejects it (reason required; the money stays in the balance). */
export async function resolveWithdrawal(id: string, status: 'completado' | 'rechazado', note?: string) {
  const { error } = await sb().rpc('admin_resolve_withdrawal', { p_id: id, p_status: status, p_note: note?.trim() || null });
  if (error) throw new Error(error.message);
}

/** Identity selfies, newest first: only pending ones, or the latest of any status. */
export const useAdminSelfies = (only?: SelfieRow['status']) =>
  useTable<SelfieRow>(async () => {
    let q = sb().from('driver_selfies').select('id, driver_id, path, status, reviewed_at, created_at').order('created_at', { ascending: false }).limit(200);
    if (only) q = q.eq('status', only);
    const { data, error } = await q;
    if (error) throw error;
    return (data as SelfieRow[]) ?? [];
  }, 'driver_selfies', { everyMs: 60_000 });

/** A driver's latest selfies (admin's driver file). */
export async function fetchDriverSelfies(driverId: string, limit = 3) {
  const { data, error } = await sb().from('driver_selfies').select('id, driver_id, path, status, reviewed_at, created_at').eq('driver_id', driverId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data as SelfieRow[]) ?? [];
}

/** Short-lived links to private selfies (10 min), keyed by path. */
export async function selfieUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await sb().storage.from('selfies').createSignedUrls(paths, 600);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

/** Approves a selfie, or rejects it (not the driver on file): that takes them offline until a new one. */
export async function reviewSelfie(id: string, status: 'aprobada' | 'rechazada') {
  const { error } = await sb().rpc('admin_review_selfie', { p_id: id, p_status: status });
  if (error) throw new Error(error.message);
}

export async function setWomenVerified(driverId: string, verified: boolean) {
  const { error } = await sb().rpc('admin_set_women_verified', { p_driver: driverId, p_verified: verified });
  if (error) throw new Error(error.message);
}

/** Approve / suspend / back to review. Suspending needs a reason (≥ 5 characters): the driver sees it and can appeal. */
export async function setDriverStatus(driverId: string, status: 'pendiente' | 'aprobado' | 'suspendido', reason?: string) {
  const { error } = await sb().rpc('set_driver_status', { p_driver: driverId, p_status: status, p_reason: reason?.trim() || null });
  if (error) throw new Error(error.message);
}

/** Answers a ticket inside the app (resolves it by default). */
export async function replyTicket(ticketId: string, reply: string, resolve = true) {
  const { error } = await sb().rpc('admin_reply_ticket', { p_ticket: ticketId, p_reply: reply.trim(), p_resolve: resolve });
  if (error) throw new Error(error.message);
}

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
