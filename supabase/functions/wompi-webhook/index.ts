// Receives Wompi "transaction.updated" events, verifies their checksum with the
// events secret and settles the matching driver top-up. Public endpoint by
// design (Wompi can't send a JWT): the checksum is the authentication.
import { createClient } from 'npm:@supabase/supabase-js@2';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const pick = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const secret = Deno.env.get('WOMPI_EVENTS_SECRET');
  if (!secret) return new Response('not configured', { status: 503 });

  let event: {
    event?: string;
    data?: { transaction?: { id: string; reference: string; status: string; amount_in_cents: number } };
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
  if (!given || expected !== given) return new Response('invalid checksum', { status: 401 });

  if (event.event !== 'transaction.updated' || !event.data?.transaction) return new Response('ignored');
  const tx = event.data.transaction;

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: topup } = await admin.from('driver_topups').select('id, amount, status').eq('id', tx.reference).maybeSingle();
  if (!topup) return new Response('unknown reference'); // not a NÜVA top-up: acknowledge and ignore
  if (topup.status === 'pagado') return new Response('already settled');

  if (tx.status === 'APPROVED') {
    // Only credit what the driver actually paid for this reference.
    if (Number(tx.amount_in_cents) !== topup.amount * 100) {
      await admin.from('driver_topups').update({ status: 'fallido', payment_ref: `${tx.id}:amount-mismatch` }).eq('id', topup.id);
      return new Response('amount mismatch');
    }
    await admin.from('driver_topups').update({ status: 'pagado', payment_ref: tx.id }).eq('id', topup.id);
  } else if (['DECLINED', 'VOIDED', 'ERROR'].includes(tx.status)) {
    await admin.from('driver_topups').update({ status: 'fallido', payment_ref: tx.id }).eq('id', topup.id);
  }
  return new Response('ok');
});
