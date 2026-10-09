// Receives Wompi "transaction.updated" events, verifies their checksum with the
// events secret and settles the matching driver top-up. Public endpoint by
// design (Wompi can't send a JWT): the checksum is the authentication.
import { createClient } from 'npm:@supabase/supabase-js@2';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison (the checksum must not leak through timing). */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const pick = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const secret = Deno.env.get('WOMPI_EVENTS_SECRET');
  if (!secret) return new Response('not configured', { status: 503 });

  let event: {
    event?: string;
    data?: { transaction?: { id: string; reference: string; status: string; amount_in_cents: number; currency?: string } };
    signature?: { properties: string[]; checksum: string };
    timestamp?: number;
  };
  try {
    event = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }

  // Checksum = SHA256( values of signature.properties from data + timestamp + events secret )
  const props = event.signature?.properties ?? [];
  const concatenated = props.map((p) => String(pick(event.data, p) ?? '')).join('') + String(event.timestamp ?? '') + secret;
  const expected = await sha256(concatenated);
  const given = (event.signature?.checksum ?? req.headers.get('x-event-checksum') ?? '').toLowerCase();
  if (!given || !safeEqual(expected, given)) return new Response('invalid checksum', { status: 401 });

  if (event.event !== 'transaction.updated' || !event.data?.transaction) return new Response('ignored');
  const tx = event.data.transaction;

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: topup, error: readError } = await admin.from('driver_topups').select('id, amount, status').eq('id', tx.reference).maybeSingle();
  // A database error must not be acknowledged: a non-2xx answer makes Wompi retry later.
  if (readError) return new Response('db error', { status: 500 });
  if (!topup) return new Response('unknown reference'); // not a NÜVA top-up: acknowledge and ignore
  if (topup.status === 'pagado') return new Response('already settled');

  /**
   * Conditional update, so two events can't race: an approval may settle a pending
   * row or one that failed before (the driver retried in the same checkout, same
   * reference); a failure only touches a row that is still pending.
   */
  const settle = async (status: 'pagado' | 'fallido', ref: string) => {
    const from = status === 'pagado' ? ['pendiente', 'fallido'] : ['pendiente'];
    const { error } = await admin.from('driver_topups').update({ status, payment_ref: ref }).eq('id', topup.id).in('status', from);
    return error ? new Response('db error', { status: 500 }) : new Response('ok');
  };

  if (tx.status === 'APPROVED') {
    // Only credit what the driver actually paid for this reference, in pesos.
    if (Number(tx.amount_in_cents) !== topup.amount * 100 || (tx.currency && tx.currency !== 'COP')) {
      return settle('fallido', `${tx.id}:amount-mismatch`);
    }
    return settle('pagado', tx.id);
  }
  if (['DECLINED', 'VOIDED', 'ERROR'].includes(tx.status)) return settle('fallido', tx.id);
  return new Response('ok');
});
