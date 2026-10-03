import { AppState, Platform } from 'react-native';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { authStorage } from './storage';
import type { CategoryId, CategoryPricing, PricingConfig } from './fare';

/**
 * Supabase is optional: without the two env vars the app runs fully on local
 * mock data (prototype mode). With them, pricing, admin auth and metrics are
 * real and shared between every device.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const backendEnabled = Boolean(url && key);

export const supabase: SupabaseClient | null = backendEnabled
  ? createClient(url!, key!, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

// ─── Pricing mapping (DB row ⇄ app config) ─────────────────────────────────

export interface PricingRow {
  version: number;
  base_fare: number;
  price_per_km: number;
  price_per_minute: number;
  minimum_fare: number;
  commission_pct: number | string;
  categories: Record<CategoryId, CategoryPricing>;
  country?: string;
}

export function rowToPricing(r: PricingRow): PricingConfig {
  return {
    baseFare: Number(r.base_fare),
    pricePerKm: Number(r.price_per_km),
    pricePerMinute: Number(r.price_per_minute),
    minimumFare: Number(r.minimum_fare),
    commissionPct: Number(r.commission_pct),
    categories: r.categories,
  };
}

/** Latest published rates for one country (each country has its own versions). */
export async function fetchCurrentPricing(country: string): Promise<{ config: PricingConfig; version: number } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('pricing_versions').select('*').eq('country', country).order('version', { ascending: false }).limit(1).single();
  if (error || !data) return null;
  return { config: rowToPricing(data as PricingRow), version: (data as PricingRow).version };
}

export async function publishPricingRemote(config: PricingConfig, country: string, note?: string): Promise<number> {
  if (!supabase) throw new Error('Backend no configurado');
  const { data, error } = await supabase.rpc('publish_pricing', { p_config: { ...config, country }, p_note: note ?? null });
  if (error) throw new Error(error.message);
  return data as number;
}

export type Role = 'passenger' | 'driver' | 'admin';

export async function fetchMyRole(): Promise<Role | null> {
  if (!supabase) return null;
  const { data } = await supabase.rpc('my_role');
  return (data as Role) ?? null;
}

export interface AdminDashboard {
  trips: number;
  cancellations: number;
  volume: number;
  commission: number;
  averageFare: number;
  activeDrivers: number;
  activePassengers: number;
  live: number;
  pricingVersion: number;
}

export async function fetchAdminDashboard(days = 30): Promise<AdminDashboard | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('admin_dashboard', { p_days: days });
  if (error) return null;
  return data as AdminDashboard;
}
