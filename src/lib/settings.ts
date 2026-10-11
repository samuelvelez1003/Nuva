import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { CountryCode } from './countries';
import { useCountry } from './country';

/** Wallet rules the admin controls (table nuva_settings). Defaults match the server's. */
export interface NuvaSettings {
  welcomeBonus: number;
  minTopup: number;
  lowBalance: number;
  /** A new driver's first N completed trips pay no commission. */
  freeTrips: number;
  /** From this completed trip of the month, the commission drops to tierPct. */
  tierThreshold: number;
  tierPct: number;
  /** How far below 0 a balance may go when accepting a trip. */
  debtAllowance: number;
  /** Waiting at the pickup: free minutes, then this per minute (100 % the driver's). */
  waitFreeMin: number;
  waitPerMin: number;
  /** Passenger cancels after the driver arrived, or doesn't show up within N minutes. */
  noShowFee: number;
  noShowWaitMin: number;
  /** Weekly challenge: N completed trips → this % for the rest of the week. */
  challengeTrips: number;
  challengePct: number;
  /** Weekly pass: no commission for 7 days. */
  passPrice: number;
  passEnabled: boolean;
  /** Requests farther than this aren't offered to the driver. */
  maxPickupKm: number;
}

export const DEFAULT_SETTINGS: NuvaSettings = {
  welcomeBonus: 0, minTopup: 20000, lowBalance: 5000, freeTrips: 10, tierThreshold: 100, tierPct: 10, debtAllowance: 10000,
  waitFreeMin: 3, waitPerMin: 150, noShowFee: 3000, noShowWaitMin: 5, challengeTrips: 40, challengePct: 8, passPrice: 60000, passEnabled: true, maxPickupKm: 4,
};

interface Row {
  welcome_bonus: number;
  min_topup: number;
  low_balance: number;
  free_trips: number;
  tier_threshold: number;
  tier_pct: number | string;
  debt_allowance: number;
  wait_free_min: number;
  wait_per_min: number;
  no_show_fee: number;
  no_show_wait_min: number;
  challenge_trips: number;
  challenge_pct: number | string;
  pass_price: number;
  pass_enabled: boolean;
  max_pickup_km: number | string;
}

const COLUMNS =
  'welcome_bonus, min_topup, low_balance, free_trips, tier_threshold, tier_pct, debt_allowance, wait_free_min, wait_per_min, no_show_fee, no_show_wait_min, challenge_trips, challenge_pct, pass_price, pass_enabled, max_pickup_km';
const fromRow = (r: Row): NuvaSettings => ({
  welcomeBonus: r.welcome_bonus,
  minTopup: r.min_topup,
  lowBalance: r.low_balance,
  freeTrips: r.free_trips,
  tierThreshold: r.tier_threshold,
  tierPct: Number(r.tier_pct),
  debtAllowance: r.debt_allowance,
  waitFreeMin: r.wait_free_min,
  waitPerMin: r.wait_per_min,
  noShowFee: r.no_show_fee,
  noShowWaitMin: r.no_show_wait_min,
  challengeTrips: r.challenge_trips,
  challengePct: Number(r.challenge_pct),
  passPrice: r.pass_price,
  passEnabled: r.pass_enabled,
  maxPickupKm: Number(r.max_pickup_km),
});

/** Defaults per country, in that currency's minor unit (COP pesos / XCG cents). */
const DEFAULTS: Record<CountryCode, NuvaSettings> = {
  CO: DEFAULT_SETTINGS,
  CW: {
    welcomeBonus: 0, minTopup: 1800, lowBalance: 500, freeTrips: 10, tierThreshold: 100, tierPct: 13, debtAllowance: 1000,
    waitFreeMin: 3, waitPerMin: 15, noShowFee: 300, noShowWaitMin: 5, challengeTrips: 40, challengePct: 10, passPrice: 6000, passEnabled: true, maxPickupKm: 8,
  },
};

/** Wallet rules of the active country (each country has its own row). */
export function useNuvaSettings() {
  const { code } = useCountry();
  const [settings, setSettings] = useState<NuvaSettings>(DEFAULTS[code]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('nuva_settings').select(COLUMNS).eq('country', code).maybeSingle();
    if (data) setSettings(fromRow(data as Row));
    setLoaded(true);
  }, [code]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Admin only (enforced by the server). */
  const save = useCallback(async (next: NuvaSettings) => {
    if (!supabase) throw new Error('Backend no configurado');
    const { data, error } = await supabase.rpc('update_settings', {
      p: {
        country: code,
        welcome_bonus: next.welcomeBonus,
        min_topup: next.minTopup,
        low_balance: next.lowBalance,
        free_trips: next.freeTrips,
        tier_threshold: next.tierThreshold,
        tier_pct: next.tierPct,
        debt_allowance: next.debtAllowance,
        wait_free_min: next.waitFreeMin,
        wait_per_min: next.waitPerMin,
        no_show_fee: next.noShowFee,
        no_show_wait_min: next.noShowWaitMin,
        challenge_trips: next.challengeTrips,
        challenge_pct: next.challengePct,
        pass_price: next.passPrice,
        pass_enabled: next.passEnabled,
        max_pickup_km: next.maxPickupKm,
      },
    });
    if (error) throw new Error(error.message);
    setSettings(fromRow(data as Row));
  }, [code]);

  return { settings, loaded, refresh, save };
}
