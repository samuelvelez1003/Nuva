import { supabase } from './supabase';

/**
 * Card payments through NÜVA's Wompi account: the passenger types the card on Wompi's
 * checkout (or uses a card saved in the wallet). The `wompi` server function prices and
 * signs every charge in pesos and confirms the transaction with Wompi before marking the
 * trip (or a driver's top-up) paid.
 */
export interface WompiCheckout {
  publicKey: string;
  reference: string;
  amountInCents: number;
  currency: 'COP';
  signature: string;
  redirectUrl: string;
  /** Wompi's hosted checkout (used by the native app). */
  checkoutUrl: string;
  /** Pesos charged: fare − promo + tip. */
  amount: number;
  live: boolean;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Sin conexión con el servidor');
  const { data, error } = await supabase.functions.invoke('wompi', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null;
    throw new Error(msg ?? error.message);
  }
  if (data?.error && !data.status) throw new Error(data.error);
  return data as T;
}

export interface WompiConfig {
  configured: boolean;
  live: boolean;
  /** Saved cards need the private key on the server. */
  savedCards: boolean;
  publicKey: string | null;
  /** Wompi's terms and personal-data authorization, accepted before saving a card. */
  acceptanceToken?: string | null;
  termsUrl?: string | null;
  personalAuthToken?: string | null;
  personalAuthUrl?: string | null;
}

let config: Promise<WompiConfig> | null = null;
export const wompiConfig = () => (config ??= call<WompiConfig>({ action: 'config' }).catch((e) => {
  config = null;
  throw e;
}));

// ─── Saved cards (wallet) ───────────────────────────────────────────────────

export interface SavedCard {
  id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
}

export const cardLabel = (c: SavedCard) => `${c.brand ?? 'Tarjeta'} •••• ${c.last4 ?? '····'}`;

/** The user's saved cards for the current Wompi mode (test cards never show live). */
export async function listSavedCards(live: boolean): Promise<SavedCard[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('saved_cards').select('id, brand, last4, exp_month, exp_year').eq('live', live).order('created_at', { ascending: false });
  return (data as SavedCard[]) ?? [];
}

export interface NewCard {
  number: string;
  holder: string;
  expMonth: string;
  expYear: string;
  cvc: string;
}

/**
 * Saves a card: the card data goes from the app straight to Wompi (never to NÜVA's
 * server), which answers a one-time token; the server turns it into a reusable payment source.
 */
export async function saveCard(card: NewCard, cfg: WompiConfig): Promise<SavedCard> {
  if (!cfg.publicKey) throw new Error('Wompi');
  const api = cfg.publicKey.startsWith('pub_prod_') ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';
  const r = await fetch(`${api}/tokens/cards`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.publicKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number: card.number.replace(/\D/g, ''),
      cvc: card.cvc.replace(/\D/g, ''),
      exp_month: card.expMonth.padStart(2, '0'),
      exp_year: card.expYear.slice(-2),
      card_holder: card.holder.trim(),
    }),
  });
  const token = (await r.json().catch(() => null))?.data;
  if (!r.ok || !token?.id) throw new Error('card');
  const res = await call<{ card: SavedCard }>({
    action: 'save-card',
    token: token.id,
    brand: token.brand,
    last4: token.last_four,
    expMonth: token.exp_month,
    expYear: token.exp_year,
    holder: token.name,
    acceptanceToken: cfg.acceptanceToken,
    personalAuthToken: cfg.personalAuthToken,
  });
  return res.card;
}

export const removeSavedCard = (cardId: string) => call<{ removed: boolean }>({ action: 'remove-card', cardId });

// ─── Passengers: paying a finished card trip ───────────────────────────────

export type Confirm = { paid: boolean; status?: string; error?: string };

/** Charges a saved card for a finished trip, then waits for Wompi's answer. */
export async function paySavedCard(tripId: string, tip: number, cardId: string) {
  const r = await call<{ transactionId?: string; paid?: boolean }>({ action: 'pay-saved', tripId, tip, cardId });
  if (r.paid) return { paid: true } as Confirm;
  if (!r.transactionId) throw new Error('Wompi');
  return confirmWompi(tripId, r.transactionId);
}

export const createWompiCheckout = (tripId: string, tip: number) => call<WompiCheckout & { paid?: boolean }>({ action: 'create', tripId, tip });

/** Waits while the bank still processes a transaction (up to ~40 s). */
async function poll(once: () => Promise<Confirm>): Promise<Confirm> {
  for (let i = 0; i < 14; i++) {
    const r = await once();
    if (r.paid || r.status !== 'PENDING') return r;
    await new Promise((res) => setTimeout(res, 3000));
  }
  return { paid: false, status: 'PENDING' };
}

/** Confirms a trip's Wompi transaction with the server. */
export const confirmWompi = (tripId: string, transactionId: string) => poll(() => call<Confirm>({ action: 'confirm', tripId, transactionId }));

// ─── Drivers: top-up with a saved card (one tap, credited at once) ─────────

export async function topUpWithSavedCard(amount: number, cardId: string): Promise<Confirm> {
  const r = await call<{ topupId: string; transactionId: string }>({ action: 'topup-saved', amount, cardId });
  return poll(() => call<Confirm>({ action: 'topup-confirm', topupId: r.topupId, transactionId: r.transactionId }));
}
