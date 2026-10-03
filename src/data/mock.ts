import type { CategoryId, TripMetrics } from '../lib/fare';
import { COUNTRIES, CountryCode, PaymentId } from '../lib/countries';
import type { TFunction, TKey } from '../i18n';

/** Deterministic PRNG so mock data is identical on every reload. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)];

// ─── People (demo mode only) ───────────────────────────────────────────────

export const PASSENGER = {
  id: 'p-001',
  firstName: 'Valentina',
  lastName: 'Ríos',
  phone: '+57 310 482 7719',
  email: 'valentina.rios@correo.co',
  rating: 4.92,
  trips: 148,
  since: 'marzo 2025',
  savedCO2Kg: 38,
};

export interface DriverProfile {
  id: string;
  name: string;
  initials: string;
  rating: number;
  trips: number;
  car: string;
  color: string;
  plate: string;
  years: number;
  tone: string;
  phoneMasked: string;
  languages?: string;
}

export const MATCH_DRIVERS: DriverProfile[] = [
  { id: 'd-201', name: 'Andrés Felipe Gómez', initials: 'AG', rating: 4.96, trips: 2341, car: 'Kia Picanto', color: 'Gris plata', plate: 'JKT 482', years: 3, tone: '#C8D9B0', phoneMasked: '+57 3•• ••• 4471' },
  { id: 'd-202', name: 'Luisa Fernanda Ortiz', initials: 'LO', rating: 4.98, trips: 1784, car: 'Renault Stepway', color: 'Blanco', plate: 'GZP 119', years: 2, tone: '#E5D3B8', phoneMasked: '+57 3•• ••• 2093' },
  { id: 'd-203', name: 'Jhon Jairo Pérez', initials: 'JP', rating: 4.91, trips: 3920, car: 'Chevrolet Onix', color: 'Azul noche', plate: 'KLM 305', years: 5, tone: '#BFD2DA', phoneMasked: '+57 3•• ••• 8812' },
];

export const DRIVER_ME = {
  id: 'd-100',
  firstName: 'Camilo',
  lastName: 'Herrera',
  initials: 'CH',
  rating: 4.94,
  ratingsCount: 1268,
  lifetimeTrips: 3412,
  acceptance: 0.93,
  cancellation: 0.02,
  car: 'Mazda 2 Sedán 2023',
  color: 'Gris titanio',
  plate: 'LUV 715',
  since: 'enero 2025',
  level: 'Oro',
  bank: 'Bancolombia ahorros •• 4821',
  nequi: 'Nequi •• 7719',
};

export const PASSENGER_NAMES = [
  'Valentina R.', 'Santiago M.', 'Mariana P.', 'Juan David L.', 'Isabella C.', 'Sebastián T.', 'Daniela G.',
  'Nicolás A.', 'Laura V.', 'Mateo S.', 'Camila H.', 'Alejandro B.', 'Sofía N.', 'Felipe Q.', 'Gabriela O.',
];

// ─── Ratings & reviews ─────────────────────────────────────────────────────

export const DRIVER_REVIEWS = [
  { id: 'r1', name: 'Mariana P.', stars: 5, text: 'Súper puntual y el carro impecable. La música a buen volumen.', when: 'Hoy' },
  { id: 'r2', name: 'Juan David L.', stars: 5, text: 'Se sabe todos los atajos, llegué antes de lo esperado.', when: 'Ayer' },
  { id: 'r3', name: 'Laura V.', stars: 4, text: 'Muy amable. El aire acondicionado estaba un poco fuerte.', when: 'mar 29 sep' },
  { id: 'r4', name: 'Santiago M.', stars: 5, text: 'Me esperó mientras sacaba las maletas. Un crack.', when: 'lun 28 sep' },
];

/** i18n keys of the quick tags a passenger can pick when rating: render with `t(tag)`. */
export const RATING_TAGS_PASSENGER: TKey[] = ['pax.tag.punctual', 'pax.tag.safeDriving', 'pax.tag.cleanCar', 'pax.tag.goodMusic', 'pax.tag.friendly', 'pax.tag.knowsCity'];

// ─── Payments ──────────────────────────────────────────────────────────────

export type { PaymentId } from '../lib/countries';

/**
 * Every passenger payment goes straight to the driver. NÜVA's commission is
 * deducted automatically from the driver's prepaid wallet.
 *
 * `label`/`detail` are the Spanish texts (kept for code that isn't translated
 * yet); on screen use `paymentLabel(id, t)` / `paymentDetail(id, t)`.
 * Brand names (Nequi, Daviplata, Bancolombia) have no `labelKey`: never translated.
 */
export const PAYMENT_METHODS: {
  id: PaymentId;
  label: string;
  detail: string;
  labelKey?: TKey;
  detailKey: TKey;
  kind: 'cash' | 'wallet' | 'bank' | 'card';
  direct: boolean;
}[] = [
  { id: 'cash', label: 'Efectivo', detail: 'Pagas al conductor al llegar', labelKey: 'pay.cash.label', detailKey: 'pay.cash.detail', kind: 'cash', direct: true },
  { id: 'nequi', label: 'Nequi', detail: 'Directo al Nequi del conductor', detailKey: 'pay.nequi.detail', kind: 'wallet', direct: true },
  { id: 'daviplata', label: 'Daviplata', detail: 'Directo al Daviplata del conductor', detailKey: 'pay.daviplata.detail', kind: 'wallet', direct: true },
  { id: 'bancolombia', label: 'Bancolombia', detail: 'Transferencia a la cuenta del conductor', detailKey: 'pay.bancolombia.detail', kind: 'bank', direct: true },
  { id: 'transfer', label: 'Transferencia', detail: 'A la cuenta bancaria del conductor', labelKey: 'pay.transfer.label', detailKey: 'pay.transfer.detail', kind: 'bank', direct: true },
  { id: 'card', label: 'Tarjeta', detail: 'Débito o crédito, con el datáfono del conductor', labelKey: 'pay.card.label', detailKey: 'pay.card.detail', kind: 'card', direct: true },
];

/** Payment methods available in one country, in that country's order. */
export const paymentMethodsFor = (country: CountryCode) => COUNTRIES[country].payments.map((id) => PAYMENT_METHODS.find((m) => m.id === id)!);

/** Finds a method by id ('cash') or by its Spanish label ('Efectivo', as stored in `RideRequest.payment`). */
const findPayment = (idOrLabel: string) => PAYMENT_METHODS.find((m) => m.id === idOrLabel || m.label === idOrLabel);

/** Payment method name in the current language: `paymentLabel('cash', t)` → "Efectivo" / "Cash" / "Kèsh". */
export const paymentLabel = (idOrLabel: string, t: TFunction) => {
  const m = findPayment(idOrLabel);
  if (!m) return idOrLabel;
  return m.labelKey ? t(m.labelKey) : m.label;
};

/** One-line explanation of a payment method in the current language. */
export const paymentDetail = (idOrLabel: string, t: TFunction) => {
  const m = findPayment(idOrLabel);
  return m ? t(m.detailKey) : '';
};

// ─── Synthetic trip sample (admin simulator) ───────────────────────────────

export interface SampleTrip extends TripMetrics {
  category: CategoryId;
}

/** 600 representative urban trips. Fares are always computed, never stored. */
export const TRIP_SAMPLE: SampleTrip[] = (() => {
  const r = rng(2026);
  const mix: [CategoryId, number][] = [['go', 0.52], ['moto', 0.18], ['eco', 0.12], ['confort', 0.13], ['xl', 0.05]];
  const out: SampleTrip[] = [];
  for (let i = 0; i < 600; i++) {
    // Log-normal-ish distance: median ≈ 5.5 km, long tail to the airport.
    const d = Math.min(26, Math.max(1.1, Math.exp(1.7 + (r() + r() + r() - 1.5) * 0.9)));
    const speed = 15 + r() * 13;
    const roll = r();
    let acc = 0;
    let category: CategoryId = 'go';
    for (const [c, w] of mix) {
      acc += w;
      if (roll <= acc) {
        category = c;
        break;
      }
    }
    out.push({
      category,
      distanceKm: Math.round(d * 10) / 10,
      durationMin: Math.max(4, Math.round((d / (category === 'moto' ? speed * 1.35 : speed)) * 60 + 2)),
    });
  }
  return out;
})();

/** Daily completed-trip counts for the last 30 days (oldest first). Demo mode only. */
export const DAILY_TRIPS: { date: Date; trips: number; cancellations: number }[] = (() => {
  const r = rng(77);
  const today = new Date();
  const out = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const dow = date.getDay();
    const weekly = [0.78, 0.92, 0.95, 0.98, 1.06, 1.22, 1.12][dow];
    const growth = 1 + (29 - i) * 0.009;
    const trips = Math.round(4200 * weekly * growth * (0.94 + r() * 0.12));
    out.push({ date, trips, cancellations: Math.round(trips * (0.045 + r() * 0.025)) });
  }
  return out;
})();

/** Monthly completed trips for the last 12 months (oldest first). Demo mode only. */
export const MONTHLY_TRIPS: { month: number; year: number; trips: number }[] = (() => {
  const r = rng(12);
  const now = new Date();
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const trips = Math.round(38000 * Math.pow(1.16, 11 - i) * (0.95 + r() * 0.1));
    out.push({ month: d.getMonth(), year: d.getFullYear(), trips });
  }
  return out;
})();

export const BONUSES = [
  { id: 'b1', title: 'Reto hora pico', detail: '12 viajes entre 5 y 8 p. m. esta semana', progress: 8, goal: 12, reward: 45000 },
  { id: 'b2', title: 'Racha de aceptación', detail: 'Acepta 20 solicitudes seguidas', progress: 20, goal: 20, reward: 20000 },
  { id: 'b3', title: 'Aeropuerto premium', detail: '3 viajes desde Matecaña', progress: 1, goal: 3, reward: 15000 },
];

export { pick };
