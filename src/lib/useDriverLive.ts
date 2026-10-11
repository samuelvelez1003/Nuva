import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../store/Auth';
import { useCountry } from './country';
import { fetchDriverSummary, listOpenRequests, presenceOwner, setPresence, TripRow, watchOpenRequests } from './liveTrips';
import { supabase } from './supabase';
import { CommissionRule, fetchCommissionRule } from './commission';

export interface DriverWallet {
  balance: number;
  /** Test account: commissions are never deducted (set by an admin). */
  test?: boolean;
  movements: {
    kind: 'recarga' | 'bono' | 'comision' | 'ajuste' | 'promo' | 'pase' | 'cancelacion';
    amount: number;
    /** pagado · pendiente · fallido · vencido (a checkout abandoned for over an hour). */
    status: string;
    at: string;
    code?: string;
    note?: string | null;
    /** Commission rows: how it was charged (free trip, volume rate, standard). */
    rule?: 'free' | 'pass' | 'tier' | 'challenge' | 'standard';
  }[];
}

/**
 * Live driver state: presence heartbeat while online, open requests over
 * Realtime, today's real earnings and the prepaid NÜVA wallet.
 */
export function useDriverLive(online: boolean, onNewRequest?: (t: TripRow) => void, position?: { lat: number; lng: number; heading?: number }) {
  const { live, session } = useAuth();
  const { code: countryCode } = useCountry();
  const uid = session?.user.id;
  const enabled = live && !!uid;
  const [requests, setRequests] = useState<TripRow[]>([]);
  const [summary, setSummary] = useState<{ trips: number; gross: number; commission: number; net: number } | null>(null);
  const [wallet, setWallet] = useState<DriverWallet | null>(null);
  const [rule, setRule] = useState<CommissionRule | null>(null);
  const newReq = useRef(onNewRequest);
  newReq.current = onNewRequest;
  const pos = useRef(position);
  pos.current = position;

  const refresh = useCallback(async () => {
    if (!enabled || !supabase) return;
    const [s, w, r] = await Promise.all([fetchDriverSummary(1), supabase.rpc('driver_wallet'), fetchCommissionRule()]);
    setSummary(s);
    if (w.data) setWallet(w.data as DriverWallet);
    setRule(r);
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Presence: tell the backend we're online and where. Only real GPS is shared — no
  // invented position — and the ride screen takes over while a trip is on.
  useEffect(() => {
    if (!enabled || !uid) return;
    const beat = () => {
      if (online && presenceOwner.ride) return;
      setPresence(uid, online, online ? pos.current : undefined).catch(() => {});
    };
    beat();
    if (!online) return;
    const id = setInterval(beat, 20_000);
    return () => clearInterval(id);
  }, [enabled, uid, online]);

  // Open requests while online.
  useEffect(() => {
    if (!enabled || !online) {
      setRequests([]);
      return;
    }
    let alive = true;
    const load = () =>
      listOpenRequests(countryCode)
        .then((list) => alive && setRequests(list))
        .catch(() => {});
    load();
    // Requests taken by other drivers vanish from our RLS view without an event; re-sync.
    const poll = setInterval(load, 15_000);
    const unsub = watchOpenRequests((t, event) => {
      // Realtime sends every country's trips; keep only this driver's country.
      if ((t.country ?? 'CO') !== countryCode) return;
      setRequests((cur) => {
        const rest = cur.filter((x) => x.id !== t.id);
        return t.status === 'requested' ? [t, ...rest] : rest;
      });
      if (event === 'INSERT' && t.status === 'requested' && t.passenger_id !== uid) newReq.current?.(t);
      if (t.driver_id === uid && t.status === 'completed') refresh();
    });
    return () => {
      alive = false;
      clearInterval(poll);
      unsub();
    };
  }, [enabled, online, uid, refresh]);

  return { enabled, requests: requests.filter((r) => r.passenger_id !== uid), summary, wallet, rule, refresh };
}

/** Asks the backend for a signed Wompi checkout to top up the wallet. */
export async function startTopup(amount: number): Promise<string> {
  if (!supabase) throw new Error('Backend no configurado');
  const { data, error } = await supabase.functions.invoke('wompi-topup', { body: { amount } });
  if (error) {
    // Surface the function's own Spanish message when available.
    const ctx = (error as { context?: Response }).context;
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    throw new Error(body?.error ?? 'No se pudo iniciar la recarga');
  }
  return (data as { url: string }).url;
}
