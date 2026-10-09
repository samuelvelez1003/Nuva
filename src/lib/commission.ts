import type { FareBreakdown } from './fare';
import { supabase } from './supabase';

/**
 * This driver's commission rules right now (server rpc my_commission_rule).
 * The server applies the same rules when the driver accepts (accept_ride) and
 * stores the result on the trip, so what the driver sees here is what is deducted.
 */
export interface CommissionRule {
  /** New drivers' first N completed trips pay no commission. */
  freeTrips: number;
  freeLeft: number;
  /** Completed trips this calendar month and the volume tier they unlock. */
  monthTrips: number;
  tierThreshold: number;
  tierPct: number;
  tierActive: boolean;
  /** How far below 0 the balance may go when accepting a trip. */
  debtAllowance: number;
  balance: number;
  /** Test account: commissions are never deducted. */
  test: boolean;
}

export type CommissionKind = 'free' | 'tier' | 'standard';

export async function fetchCommissionRule(): Promise<CommissionRule | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('my_commission_rule');
  return error || !data ? null : (data as CommissionRule);
}

/**
 * The trip's fare as this driver would get it, before accepting: commission only
 * on the fare without surcharges (those are 100 % the driver's), free while the
 * driver has free trips left, the volume rate when it is lower. Same as accept_ride.
 */
export function driverFare(fare: FareBreakdown, rule?: CommissionRule | null): FareBreakdown & { commissionRule?: CommissionKind } {
  if (!rule) return fare;
  const base = fare.finalFare - (fare.nightSurcharge ?? 0) - (fare.airportSurcharge ?? 0);
  let pct = fare.commissionPct;
  let commission = fare.platformCommission;
  let kind: CommissionKind = 'standard';
  if (rule.freeLeft > 0) {
    pct = 0;
    commission = 0;
    kind = 'free';
  } else if (rule.tierActive && rule.tierPct < fare.commissionPct) {
    pct = rule.tierPct;
    commission = Math.round((base * pct) / 100);
    kind = 'tier';
  }
  return { ...fare, commissionPct: pct, platformCommission: commission, driverEarnings: fare.finalFare - commission, commissionRule: kind };
}

/** Top-up needed so this commission fits within the debt allowance (0 = can take the trip). */
export function topUpNeeded(rule: CommissionRule | null | undefined, commission: number) {
  if (!rule || rule.test) return 0;
  return Math.max(0, commission - rule.debtAllowance - rule.balance);
}
