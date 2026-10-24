import type { Profile } from '../store/Auth';
import { supabase } from './supabase';

/**
 * Driver withdrawals: what NÜVA collected for the driver (card trips, cancellation
 * fees, promotions) can be sent to their own account. Top-ups and bonuses can't —
 * they exist to pay commissions. The team pays each one by hand (admin Retiros).
 */
export type PayoutMethod = 'nequi' | 'daviplata' | 'bancolombia' | 'banco';

export const PAYOUT_METHODS: PayoutMethod[] = ['nequi', 'daviplata', 'bancolombia', 'banco'];

/** Nequi / Daviplata accounts are the 10-digit cell number (starts with 3); banks need ≥ 6 characters. */
export function validPayoutAccount(method: PayoutMethod, account: string) {
  const a = account.trim();
  if (method === 'nequi' || method === 'daviplata') return /^3\d{9}$/.test(a);
  return a.length >= 6;
}

/** The account the driver registered for this method, if any (profile.payout). */
export function savedPayoutAccount(profile: Profile | null | undefined, method: PayoutMethod) {
  const p = (profile?.payout ?? {}) as Record<string, string | undefined>;
  if (method === 'nequi') return p.nequi ?? '';
  if (method === 'daviplata') return p.daviplata ?? p.nequi ?? '';
  if (method === 'bancolombia') return p.bancolombia ?? '';
  return p.bank ?? '';
}

/** Asks for a withdrawal (one pending at a time; the server checks the minimum and what can be withdrawn). */
export async function requestWithdrawal(amount: number, method: PayoutMethod, account: string) {
  if (!supabase) throw new Error('Backend no configurado');
  const { error } = await supabase.rpc('request_withdrawal', { p_amount: Math.round(amount), p_method: method, p_account: account.trim() });
  if (error) throw new Error(error.message);
}
