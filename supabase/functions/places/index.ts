// Address search with Google Places API (New), biased to Pereira.
// The Google key lives only here (Supabase secret GOOGLE_MAPS_API_KEY) — never in the app.
// Signed-in users only, so the key's quota can't be drained by anonymous calls.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const GOOGLE = 'https://places.googleapis.com/v1';
// Plaza de Bolívar, Pereira — bias centre when the app sends no position.
const PEREIRA = { latitude: 4.81333, longitude: -75.69611 };

interface AddressComponent {
  longText: string;
  types: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const key = Deno.env.get('GOOGLE_MAPS_API_KEY');
  // 503 tells the app to fall back to OpenStreetMap search.
  if (!key) return json({ error: 'Búsqueda de Google no configurada' }, 503);

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u.user) return json({ error: 'Inicia sesión' }, 401);

  let body: { action?: string; input?: string; placeId?: string; sessionToken?: string; lat?: number; lng?: number } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Solicitud inválida' }, 400);
  }

  if (body.action === 'autocomplete') {
    const input = String(body.input ?? '').trim().slice(0, 120);
    if (input.length < 2) return json({ results: [] });
    const near = Number.isFinite(body.lat) && Number.isFinite(body.lng) ? { latitude: body.lat!, longitude: body.lng! } : PEREIRA;
    const res = await fetch(`${GOOGLE}/places:autocomplete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
      body: JSON.stringify({
        input,
        locationBias: { circle: { center: near, radius: 25000 } },
        origin: near,
        includedRegionCodes: ['co'],
        languageCode: 'es',
        sessionToken: body.sessionToken,
      }),
    });
    if (!res.ok) return json({ error: 'Google no respondió', status: res.status }, 502);
    const data = await res.json();
    const results = (data.suggestions ?? [])
      .map((s: { placePrediction?: Record<string, any> }) => s.placePrediction)
      .filter(Boolean)
      .map((p: Record<string, any>) => ({
        placeId: p.placeId,
        name: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
        address: p.structuredFormat?.secondaryText?.text ?? '',
        distanceMeters: p.distanceMeters ?? null,
      }));
    return json({ results });
  }

  if (body.action === 'details') {
    const id = String(body.placeId ?? '');
    if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return json({ error: 'Lugar inválido' }, 400);
    const qs = new URLSearchParams({ languageCode: 'es', regionCode: 'co' });
    if (body.sessionToken) qs.set('sessionToken', body.sessionToken);
    const res = await fetch(`${GOOGLE}/places/${id}?${qs}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'id,displayName,shortFormattedAddress,formattedAddress,location,addressComponents' },
    });
    if (!res.ok) return json({ error: 'Google no respondió', status: res.status }, 502);
    const p = await res.json();
    const comps: AddressComponent[] = p.addressComponents ?? [];
    const pick = (...types: string[]) => comps.find((c) => types.some((t) => c.types.includes(t)))?.longText;
    return json({
      place: {
        placeId: p.id,
        name: p.displayName?.text ?? '',
        address: p.shortFormattedAddress ?? p.formattedAddress ?? '',
        area: pick('neighborhood', 'sublocality', 'sublocality_level_1', 'locality') ?? '',
        lat: p.location?.latitude,
        lng: p.location?.longitude,
      },
    });
  }

  return json({ error: 'Acción no soportada' }, 400);
});
