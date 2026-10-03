import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { CountryCode } from './countries';
import { useCountry } from './country';

/** Wallet rules the admin controls (table nuva_settings). Defaults match the server's. */
export interface NuvaSettings {
  welcomeBonus: number;
  minTopup: number;
  lowBalance: number;
}

export const DEFAULT_SETTINGS: NuvaSettings = { welcomeBonus: 20000, minTopup: 20000, lowBalance: 5000 };

interface Row {
  welcome_bonus: number;
  min_topup: number;
  low_balance: number;
}

const fromRow = (r: Row): NuvaSettings => ({ welcomeBonus: r.welcome_bonus, minTopup: r.min_topup, lowBalance: r.low_balance });

/** Defaults per country, in that currency's minor unit (COP pesos / XCG cents). */
const DEFAULTS: Record<CountryCode, NuvaSettings> = {
  CO: DEFAULT_SETTINGS,
  CW: { welcomeBonus: 0, minTopup: 1800, lowBalance: 500 },
};

/** Wallet rules of the active country (each country has its own row). */
export function useNuvaSettings() {
  const { code } = useCountry();
  const [settings, setSettings] = useState<NuvaSettings>(DEFAULTS[code]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('nuva_settings').select('welcome_bonus, min_topup, low_balance').eq('country', code).maybeSingle();
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
      p: { country: code, welcome_bonus: next.welcomeBonus, min_topup: next.minTopup, low_balance: next.lowBalance },
    });
    if (error) throw new Error(error.message);
    setSettings(fromRow(data as Row));
  }, [code]);

  return { settings, loaded, refresh, save };
}
