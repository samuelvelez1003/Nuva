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
  /** Weekly challenge: completed trips this week and the rate it unlocks. */
  weekTrips: number;
  challengeTrips: number;
  challengePct: number;
  challengeActive: boolean;
  /** Weekly pass: no commission for 7 days, bought from the balance. */
  passEnabled: boolean;
  passPrice: number;
  passActive: boolean;
  passEndsAt: string | null;
  /** Requests farther than this aren't offered. */
  maxPickupKm: number;
  /** Waiting at the pickup and late cancellations (no-show). */
  waitFreeMin: number;
  waitPerMin: number;
  noShowFee: number;
  noShowWaitMin: number;
  /** How far below 0 the balance may go when accepting a trip. */
  debtAllowance: number;
  balance: number;
  /** Test account: commissions are never deducted. */
  test: boolean;
}

export type CommissionKind = 'free' | 'pass' | 'tier' | 'challenge' | 'standard';

export async function fetchCommissionRule(): Promise<CommissionRule | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('my_commission_rule');
  return error || !data ? null : (data as CommissionRule);
}

/**
 * The trip's fare as this driver would get it, before accepting (same as accept_ride):
 * commission only on the fare without surcharges (100 % the driver's); free while the
 * driver has free trips left or a weekly pass; otherwise the lowest of the standard,
 * monthly-volume and weekly-challenge rates. A passenger's pending cancellation fee,
 * collected in this trip, always goes back to NÜVA.
 */
export function driverFare(fare: FareBreakdown, rule?: CommissionRule | null): FareBreakdown & { commissionRule?: CommissionKind } {
  if (!rule) return fare;
  const pending = fare.pendingFee ?? 0;
  const base = fare.finalFare - pending - (fare.nightSurcharge ?? 0) - (fare.airportSurcharge ?? 0);
  let pct = fare.commissionPct;
  let kind: CommissionKind = 'standard';
  if (rule.freeLeft > 0) {
    pct = 0;
    kind = 'free';
  } else if (rule.passActive) {
    pct = 0;
    kind = 'pass';
  } else {
    if (rule.tierActive && rule.tierPct < pct) {
      pct = rule.tierPct;
      kind = 'tier';
    }
    if (rule.challengeActive && rule.challengePct < pct) {
      pct = rule.challengePct;
      kind = 'challenge';
    }
  }
  const commission = kind === 'standard' ? fare.platformCommission : Math.round((base * pct) / 100) + pending;
  return { ...fare, commissionPct: pct, platformCommission: commission, driverEarnings: fare.finalFare - commission, commissionRule: kind };
}

/** Buys the weekly pass with the balance (server checks balance and that none is active). */
export async function buyWeeklyPass() {
  if (!supabase) throw new Error('Backend no configurado');
  const { error } = await supabase.rpc('buy_weekly_pass');
  if (error) throw new Error(error.message);
}

/** Top-up needed so this commission fits within the debt allowance (0 = can take the trip). */
export function topUpNeeded(rule: CommissionRule | null | undefined, commission: number) {
  if (!rule || rule.test) return 0;
  return Math.max(0, commission - rule.debtAllowance - rule.balance);
}
