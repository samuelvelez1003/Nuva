// Address and place search through HERE Geocoding & Search.
// The key lives only here (Supabase secret HERE_API_KEY) — never in the app.
// Signed-in users only, so the key's quota can't be drained by anonymous calls.
// The app treats any error as "use OpenStreetMap search instead".
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const HERE = 'https://geocode.search.hereapi.com/v1/geocode';
const DISCOVER = 'https://discover.search.hereapi.com/v1/discover';
// App country code → HERE (ISO 3166 alpha-3).
const COUNTRY: Record<string, string> = { co: 'COL', cw: 'CUW' };

interface HereItem {
  id: string;
  title: string;
  resultType: string;
  houseNumberType?: string;
  address?: { street?: string; houseNumber?: string; district?: string; city?: string };
  position?: { lat: number; lng: number };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const key = Deno.env.get('HERE_API_KEY')?.trim();
  if (!key) return json({ error: 'Búsqueda HERE no configurada' }, 503);

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u.user) return json({ error: 'Inicia sesión' }, 401);

  let body: { q?: string; mode?: string; lat?: number; lng?: number; country?: string; city?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Solicitud inválida' }, 400);
  }

  const q = String(body.q ?? '').trim().slice(0, 120);
  const country = COUNTRY[String(body.country ?? 'co')];
  if (q.length < 3 || !country) return json({ results: [] });
  const at = Number.isFinite(body.lat) && Number.isFinite(body.lng) ? `${body.lat},${body.lng}` : '4.81333,-75.69611';
  const city = String(body.city ?? '').slice(0, 60);

  const qs = new URLSearchParams({ in: `countryCode:${country}`, at, lang: 'es', apiKey: key });
  let url: string;
  if (body.mode === 'address') {
    // Free text works far better than HERE's structured mode for "Calle 19 6-48".
    qs.set('q', city && !q.includes(',') ? `${q}, ${city}` : q);
    qs.set('limit', '5');
    url = `${HERE}?${qs}`;
  } else {
    qs.set('q', q);
    qs.set('limit', '6');
    url = `${DISCOVER}?${qs}`;
  }

  const res = await fetch(url);
  // Never echo HERE's body: it can repeat the request URL, key included.
  if (!res.ok) return json({ error: 'HERE no respondió', status: res.status }, res.status === 429 ? 429 : 502);
  const items: HereItem[] = (await res.json()).items ?? [];
  return json({
    results: items
      .filter((it) => it.position)
      .map((it) => ({
        id: it.id,
        type: it.resultType,
        exact: it.houseNumberType === 'PA',
        title: it.title,
        street: it.address?.street ?? '',
        number: it.address?.houseNumber ?? '',
        district: it.address?.district ?? '',
        city: it.address?.city ?? '',
        lat: it.position!.lat,
        lng: it.position!.lng,
      })),
  });
});
