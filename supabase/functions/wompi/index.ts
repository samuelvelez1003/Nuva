// Card payments through NÜVA's Wompi account, and saved cards. The apps call it with the
// user's session:
//   { action: 'config' }                          → whether cards (and saved cards) are on, the
//                                                    public key and Wompi's terms to accept
//   { action: 'save-card', token, brand, last4, expMonth, expYear, holder, acceptanceToken,
//     personalAuthToken }                          → turns a card token (made by the app straight
//                                                    with Wompi) into a reusable payment source
//   { action: 'remove-card', cardId }              → forgets a saved card
// Passengers, a finished card trip (fare − promo + tip):
//   { action: 'create', tripId, tip }              → signed checkout (widget / hosted page)
//   { action: 'pay-saved', tripId, tip, cardId }   → charges a saved card; then 'confirm'
//   { action: 'confirm', tripId, transactionId }   → checks the transaction with Wompi and marks
//                                                    the trip paid when it is APPROVED
// Drivers, top-up of the NÜVA balance with a saved card (one tap):
//   { action: 'topup-saved', amount, cardId }      → creates the top-up and charges the card
//   { action: 'topup-confirm', topupId, transactionId }
// Amounts are always computed here; a transaction is accepted only if its reference, amount
// and currency are the ones this function signed. `wompi-webhook` settles the same payments
// when the app closes before confirming.
// Secrets: WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET and, for saved cards, WOMPI_PRIVATE_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';

const PUBLIC_KEY = Deno.env.get('WOMPI_PUBLIC_KEY') ?? '';
const PRIVATE_KEY = Deno.env.get('WOMPI_PRIVATE_KEY') ?? '';
const INTEGRITY = Deno.env.get('WOMPI_INTEGRITY_SECRET') ?? '';
const LIVE = PUBLIC_KEY.startsWith('pub_prod_');
const API = LIVE ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';
const SITE = 'https://nuva.expo.app';
const MAX_TIP = 20_000;
const MAX_TOPUP = 1_000_000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const pesos = (n: number) => `$${n.toLocaleString('es-CO')}`;

async function wompi(path: string, init: { method?: string; body?: unknown; key?: string } = {}) {
  const r = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(init.key ? { Authorization: `Bearer ${init.key}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { ok: r.ok, data: (await r.json().catch(() => ({})))?.data ?? null };
}

/** Wompi's terms and personal-data authorization, accepted before saving a card. */
async function acceptance() {
  const m = await wompi(`/merchants/${PUBLIC_KEY}`);
  return {
    acceptanceToken: m.data?.presigned_acceptance?.acceptance_token ?? null,
    termsUrl: m.data?.presigned_acceptance?.permalink ?? null,
    personalAuthToken: m.data?.presigned_personal_data_auth?.acceptance_token ?? null,
    personalAuthUrl: m.data?.presigned_personal_data_auth?.permalink ?? null,
  };
}

const JWKS = createRemoteJWKSet(new URL(`${Deno.env.get('SUPABASE_URL')}/auth/v1/.well-known/jwks.json`));

/**
 * The signed-in user making the request. Auth's getUser() comes first; if it can't resolve
 * the session (new asymmetric signing keys), the JWT is verified here against the project's
 * public keys and the user is loaded by its id.
 */
async function caller(req: Request, userClient: ReturnType<typeof createClient>) {
  const { data, error } = await userClient.auth.getUser();
  if (data.user) return data.user;
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const { payload } = await jwtVerify(token, JWKS, { issuer: `${url}/auth/v1` });
    if (payload.role === 'authenticated' && typeof payload.sub === 'string') {
      const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
      const { data: byId } = await admin.auth.admin.getUserById(payload.sub);
      if (byId.user) return byId.user;
    }
  } catch (e) {
    console.error('auth: token not verified', e instanceof Error ? e.message : e);
  }
  console.error('auth: no user', error?.message);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Solicitud inválida' }, 400);
  }
  const configured = !!PUBLIC_KEY && !!INTEGRITY;
  const savedCards = configured && !!PRIVATE_KEY;
  if (body.action === 'config') {
    return json({ configured, live: LIVE, savedCards, publicKey: configured ? PUBLIC_KEY : null, ...(savedCards ? await acceptance() : {}) });
  }
  if (!configured) return json({ error: 'El pago con tarjeta no está configurado' }, 503);

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const u = { user: await caller(req, userClient) };
  if (!u.user) return json({ error: 'Inicia sesión' }, 401);
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  /** Charges a saved card of this user; returns Wompi's transaction id. */
  const chargeSaved = async (cardId: unknown, amountInCents: number, reference: string, signature: string) => {
    const { data: card } = await admin.from('saved_cards').select('source_id').eq('id', String(cardId ?? '')).eq('user_id', u.user.id).maybeSingle();
    if (!card) return { error: json({ error: 'Tarjeta no encontrada' }, 404) };
    const tx = await wompi('/transactions', {
      method: 'POST',
      key: PRIVATE_KEY,
      body: {
        amount_in_cents: amountInCents,
        currency: 'COP',
        signature,
        customer_email: u.user.email,
        reference,
        payment_method: { installments: 1 },
        payment_source_id: card.source_id,
      },
    });
    if (!tx.ok || !tx.data?.id) return { error: json({ error: 'Wompi no pudo cobrar la tarjeta guardada' }, 402) };
    return { id: String(tx.data.id) };
  };

  try {
    // ── Saved cards ──────────────────────────────────────────────────────────
    if (body.action === 'save-card') {
      if (!savedCards) return json({ error: 'Guardar tarjetas aún no está disponible' }, 503);
      const token = String(body.token ?? '');
      if (!token.startsWith('tok_')) return json({ error: 'Tarjeta no válida' }, 400);
      const source = await wompi('/payment_sources', {
        method: 'POST',
        key: PRIVATE_KEY,
        body: {
          type: 'CARD',
          token,
          customer_email: u.user.email,
          acceptance_token: String(body.acceptanceToken ?? ''),
          accept_personal_auth: String(body.personalAuthToken ?? ''),
        },
      });
      if (!source.ok || !source.data?.id) return json({ error: 'Wompi no pudo guardar la tarjeta. Revisa los datos.' }, 402);
      const last4 = String(body.last4 ?? '').replace(/\D/g, '').slice(-4);
      const { data: card, error } = await admin
        .from('saved_cards')
        .insert({
          user_id: u.user.id,
          source_id: source.data.id,
          brand: String(body.brand ?? '').slice(0, 20) || null,
          last4: last4.length === 4 ? last4 : null,
          exp_month: Number(body.expMonth) || null,
          exp_year: Number(body.expYear) || null,
          holder: String(body.holder ?? '').slice(0, 60) || null,
          live: LIVE,
        })
        .select('id, brand, last4, exp_month, exp_year')
        .single();
      if (error) return json({ error: 'No se pudo guardar la tarjeta' }, 500);
      return json({ card });
    }

    if (body.action === 'remove-card') {
      await admin.from('saved_cards').delete().eq('id', String(body.cardId ?? '')).eq('user_id', u.user.id);
      return json({ removed: true });
    }

    // ── Drivers: top-up with a saved card ────────────────────────────────────
    if (body.action === 'topup-saved') {
      if (!savedCards) return json({ error: 'Recargar con tarjeta guardada aún no está disponible' }, 503);
      const { data: profile } = await admin.from('profiles').select('role, country').eq('id', u.user.id).single();
      if (!profile || (profile.role !== 'driver' && profile.role !== 'admin')) return json({ error: 'Solo conductores pueden recargar saldo' }, 403);
      const { data: settings } = await admin.from('nuva_settings').select('min_topup').eq('country', 'CO').maybeSingle();
      const min = Number(settings?.min_topup) || 20_000;
      const amount = Math.round(Number(body.amount));
      if (!Number.isInteger(amount) || amount < min || amount > MAX_TOPUP) return json({ error: `La recarga debe estar entre ${pesos(min)} y ${pesos(MAX_TOPUP)}` }, 400);
      const { data: topup, error } = await admin.from('driver_topups').insert({ driver_id: u.user.id, amount, status: 'pendiente', method: 'wompi' }).select('id').single();
      if (error || !topup) return json({ error: 'No se pudo crear la recarga' }, 500);
      const reference = String(topup.id);
      const cents = amount * 100;
      const charged = await chargeSaved(body.cardId, cents, reference, await sha256Hex(`${reference}${cents}COP${INTEGRITY}`));
      if (charged.error) {
        await admin.from('driver_topups').update({ status: 'fallido' }).eq('id', reference).eq('status', 'pendiente');
        return charged.error;
      }
      return json({ topupId: reference, transactionId: charged.id });
    }

    if (body.action === 'topup-confirm') {
      const { data: topup } = await admin.from('driver_topups').select('id, driver_id, amount, status').eq('id', String(body.topupId ?? '')).maybeSingle();
      if (!topup || topup.driver_id !== u.user.id) return json({ error: 'Recarga no encontrada' }, 404);
      if (topup.status === 'pagado') return json({ paid: true });
      const { data: tx } = await wompi(`/transactions/${encodeURIComponent(String(body.transactionId ?? ''))}`);
      if (!tx || tx.reference !== topup.id || tx.amount_in_cents !== topup.amount * 100 || tx.currency !== 'COP') {
        return json({ error: 'Wompi no reconoce esta recarga' }, 402);
      }
      if (tx.status === 'PENDING') return json({ paid: false, status: 'PENDING' });
      if (tx.status !== 'APPROVED') {
        await admin.from('driver_topups').update({ status: 'fallido', payment_ref: tx.id }).eq('id', topup.id).eq('status', 'pendiente');
        return json({ paid: false, status: tx.status, error: 'El banco rechazó el pago con esta tarjeta' });
      }
      await admin.from('driver_topups').update({ status: 'pagado', payment_ref: tx.id }).eq('id', topup.id).in('status', ['pendiente', 'fallido']);
      return json({ paid: true });
    }

    // ── Passengers: paying a finished card trip ──────────────────────────────
    const { data: trip } = await admin
      .from('trips')
      .select('id, code, passenger_id, status, payment, payment_status, payment_ref, final_fare, discount, tip')
      .eq('id', String(body.tripId ?? ''))
      .maybeSingle();
    if (!trip || trip.passenger_id !== u.user.id) return json({ error: 'Viaje no encontrado' }, 404);
    if (trip.payment !== 'card') return json({ error: 'Este viaje no se paga con tarjeta' }, 400);
    if (trip.payment_status === 'pagado') return json({ paid: true });
    if (trip.status !== 'completed') return json({ error: 'El viaje aún no ha terminado' }, 400);

    // Price + signature shared by the checkout and the saved-card charge.
    const sign = async () => {
      const tip = Math.max(0, Math.min(MAX_TIP, Math.round(Number(body.tip) || 0)));
      const amount = trip.final_fare - (trip.discount ?? 0) + tip;
      const amountInCents = amount * 100;
      const reference = `${trip.code}-${Date.now().toString(36)}`;
      const signature = await sha256Hex(`${reference}${amountInCents}COP${INTEGRITY}`);
      // The tip goes with this charge; the reference + amount are what confirm will accept.
      await admin.from('trips').update({ tip, payment_ref: `wompi-ref:${reference}:${amountInCents}` }).eq('id', trip.id);
      return { amount, amountInCents, reference, signature };
    };

    if (body.action === 'create') {
      const s = await sign();
      const redirectUrl = `${SITE}/pago?trip=${trip.id}`;
      const checkoutUrl =
        `https://checkout.wompi.co/p/?public-key=${encodeURIComponent(PUBLIC_KEY)}&currency=COP&amount-in-cents=${s.amountInCents}` +
        `&reference=${encodeURIComponent(s.reference)}&signature%3Aintegrity=${s.signature}&redirect-url=${encodeURIComponent(redirectUrl)}`;
      return json({ publicKey: PUBLIC_KEY, reference: s.reference, amountInCents: s.amountInCents, currency: 'COP', signature: s.signature, redirectUrl, checkoutUrl, amount: s.amount, live: LIVE });
    }

    if (body.action === 'pay-saved') {
      if (!savedCards) return json({ error: 'Pagar con tarjeta guardada aún no está disponible' }, 503);
      const s = await sign();
      const charged = await chargeSaved(body.cardId, s.amountInCents, s.reference, s.signature);
      if (charged.error) return charged.error;
      return json({ transactionId: charged.id });
    }

    if (body.action === 'confirm') {
      const id = String(body.transactionId ?? '');
      const [, reference, cents] = /^wompi-ref:(.+):(\d+)$/.exec(trip.payment_ref ?? '') ?? [];
      if (!id || !reference) return json({ error: 'Pago no reconocido' }, 400);
      const { data: tx } = await wompi(`/transactions/${encodeURIComponent(id)}`);
      if (!tx || tx.reference !== reference || tx.amount_in_cents !== Number(cents) || tx.currency !== 'COP') {
        return json({ error: 'Wompi no reconoce este pago' }, 402);
      }
      if (tx.status === 'PENDING') return json({ paid: false, status: 'PENDING' });
      if (tx.status !== 'APPROVED') return json({ paid: false, status: tx.status, error: 'El banco rechazó el pago con esta tarjeta' });
      await admin
        .from('trips')
        .update({ payment_status: 'pagado', paid_at: new Date().toISOString(), payment_ref: `wompi:${tx.id}` })
        .eq('id', trip.id)
        .neq('payment_status', 'pagado');
      return json({ paid: true });
    }

    return json({ error: 'Acción no válida' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Error con Wompi' }, 502);
  }
});
