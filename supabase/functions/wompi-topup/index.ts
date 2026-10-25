// Creates a driver top-up and returns a signed Wompi Web Checkout URL.
// The Wompi keys live only here (Supabase secrets) — never in the app.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The minimum comes from nuva_settings (admin-controlled); this is only the fallback.
const DEFAULT_MIN = 20_000;
const MAX = 1_000_000;

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

  const publicKey = Deno.env.get('WOMPI_PUBLIC_KEY');
  const integrity = Deno.env.get('WOMPI_INTEGRITY_SECRET');
  if (!publicKey || !integrity) return json({ error: 'Los pagos con Wompi aún no están configurados' }, 503);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Who is asking? (JWT already verified by the platform; we still resolve the user.)
  const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const u = { user: await caller(req, userClient) };
  if (!u.user) return json({ error: 'Inicia sesión' }, 401);

  const admin = createClient(url, service);
  const { data: profile } = await admin.from('profiles').select('role, driver_status, email, full_name, phone, country').eq('id', u.user.id).single();
  if (!profile || (profile.role !== 'driver' && profile.role !== 'admin')) return json({ error: 'Solo conductores pueden recargar saldo' }, 403);
  // Wompi only operates in Colombia (COP); Curaçao top-ups are credited by NÜVA for now.
  if ((profile.country ?? 'CO') !== 'CO') return json({ error: 'Las recargas con tarjeta en tu país llegan muy pronto. Escríbenos desde Soporte para recargar.' }, 400);

  const { data: settings } = await admin.from('nuva_settings').select('min_topup').eq('country', 'CO').maybeSingle();
  const MIN = Number(settings?.min_topup) || DEFAULT_MIN;

  let amount = 0;
  try {
    amount = Math.round(Number((await req.json()).amount));
  } catch {
    /* handled below */
  }
  if (!Number.isInteger(amount) || amount < MIN || amount > MAX) return json({ error: `La recarga debe estar entre $${MIN.toLocaleString('es-CO')} y $${MAX.toLocaleString('es-CO')}` }, 400);

  const { data: topup, error } = await admin.from('driver_topups').insert({ driver_id: u.user.id, amount, status: 'pendiente', method: 'wompi' }).select('id').single();
  if (error || !topup) return json({ error: 'No se pudo crear la recarga' }, 500);

  const reference = topup.id as string;
  const cents = String(amount * 100);
  const signature = await sha256(`${reference}${cents}COP${integrity}`);
  const redirect = Deno.env.get('WOMPI_REDIRECT_URL') ?? 'https://nuva.expo.app/recarga';

  const params = new URLSearchParams({
    'public-key': publicKey,
    currency: 'COP',
    'amount-in-cents': cents,
    reference,
    'signature:integrity': signature,
    'redirect-url': `${redirect}?ref=${reference}`,
  });
  if (profile.email) params.set('customer-data:email', profile.email);
  if (profile.full_name) params.set('customer-data:full-name', profile.full_name);

  return json({ url: `https://checkout.wompi.co/p/?${params.toString()}`, reference, amount });
});
