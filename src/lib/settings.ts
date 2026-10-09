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
}

export const DEFAULT_SETTINGS: NuvaSettings = { welcomeBonus: 0, minTopup: 20000, lowBalance: 5000, freeTrips: 10, tierThreshold: 100, tierPct: 10, debtAllowance: 10000 };

interface Row {
  welcome_bonus: number;
  min_topup: number;
  low_balance: number;
  free_trips: number;
  tier_threshold: number;
  tier_pct: number | string;
  debt_allowance: number;
}

const COLUMNS = 'welcome_bonus, min_topup, low_balance, free_trips, tier_threshold, tier_pct, debt_allowance';
const fromRow = (r: Row): NuvaSettings => ({
  welcomeBonus: r.welcome_bonus,
  minTopup: r.min_topup,
  lowBalance: r.low_balance,
  freeTrips: r.free_trips,
  tierThreshold: r.tier_threshold,
  tierPct: Number(r.tier_pct),
  debtAllowance: r.debt_allowance,
});

/** Defaults per country, in that currency's minor unit (COP pesos / XCG cents). */
const DEFAULTS: Record<CountryCode, NuvaSettings> = {
  CO: DEFAULT_SETTINGS,
  CW: { welcomeBonus: 0, minTopup: 1800, lowBalance: 500, freeTrips: 10, tierThreshold: 100, tierPct: 13, debtAllowance: 1000 },
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
      },
    });
    if (error) throw new Error(error.message);
    setSettings(fromRow(data as Row));
  }, [code]);

  return { settings, loaded, refresh, save };
}
