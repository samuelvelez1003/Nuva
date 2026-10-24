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
  /** Weekly pass: no commission for 7 days, bought from the balance (the daily one below: 24 h). */
  passEnabled: boolean;
  passPrice: number;
  passActive: boolean;
  passEndsAt: string | null;
  /** Which pass is active ('day' | 'week'), if any. */
  passKind: 'day' | 'week' | null;
  /** Daily pass: no commission for 24 hours. */
  dayPassEnabled: boolean;
  dayPassPrice: number;
  /** What can be withdrawn now (card trips, cancellations, promotions; never top-ups). */
  withdrawable: number;
  minWithdrawal: number;
  /** Identity check: a selfie every N hours before taking trips (0 = off). */
  selfieHours: number;
  selfieAt: string | null;
  selfieOk: boolean;
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

/** Buys a pass with the balance: 'day' = 24 h, 'week' = 7 days without commission (server checks balance and that none is active). */
export async function buyPass(kind: 'day' | 'week') {
  if (!supabase) throw new Error('Backend no configurado');
  const { error } = await supabase.rpc('buy_pass', { p_kind: kind });
  if (error) throw new Error(error.message);
}

export const buyWeeklyPass = () => buyPass('week');

/**
 * Top-up needed so this commission fits within the debt allowance (0 = can take the trip).
 * A card trip needs none: the passenger pays NÜVA, which keeps the commission and credits the rest.
 */
export function topUpNeeded(rule: CommissionRule | null | undefined, commission: number, payment?: string) {
  if (!rule || rule.test || payment === 'card') return 0;
  return Math.max(0, commission - rule.debtAllowance - rule.balance);
}

/** The selfie identity check is due before taking trips (admins testing as drivers are exempt server-side). */
export const selfieDue = (rule: CommissionRule | null | undefined) => !!rule && rule.selfieHours > 0 && !rule.selfieOk;
