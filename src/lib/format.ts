/**
 * Formatting helpers. Written by hand instead of Intl so output is identical
 * on Hermes (iOS/Android) and on the web.
 *
 * Money amounts are integers in the active local currency's minor unit:
 *   COP → pesos ("$12.600"), XCG → cents (1250 → "Cg12,50").
 * The active currency follows the selected country (setMoneyCurrency).
 */

const group = (n: number) => Math.abs(Math.trunc(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

let CURRENCY: { code: string; symbol: string; minorDigits: 0 | 2 } = { code: 'COP', symbol: '$', minorDigits: 0 };
export function setMoneyCurrency(code: string, symbol: string, minorDigits: 0 | 2) {
  CURRENCY = { code, symbol, minorDigits };
}
export const moneyCurrency = () => CURRENCY;
const symbol = () => CURRENCY.symbol;

/** Minor units → the number people type/read (XCG 1250 → 12.5). */
export const toMajor = (minor: number) => (CURRENCY.minorDigits ? minor / 10 ** CURRENCY.minorDigits : minor);
/** What people type → minor units (XCG 12.5 → 1250). */
export const toMinor = (major: number) => Math.round(CURRENCY.minorDigits ? major * 10 ** CURRENCY.minorDigits : major);

function body(abs: number) {
  if (!CURRENCY.minorDigits) return group(abs);
  const major = Math.trunc(abs / 100);
  const cents = (abs % 100).toString().padStart(2, '0');
  return `${group(major)},${cents}`;
}

/** Money in the active currency: "$12.600" (COP) or "Cg12,50" (XCG). */
export function cop(amount: number): string {
  const n = Math.round(amount);
  return `${n < 0 ? '−' : ''}${symbol()}${body(Math.abs(n))}`;
}

/** Signed variant for deltas: "+$1.200" / "−Cg0,80". */
export function copDelta(amount: number): string {
  const n = Math.round(amount);
  if (n === 0) return `${symbol()}0`;
  return `${n > 0 ? '+' : '−'}${symbol()}${body(Math.abs(n))}`;
}

/** Compact amounts for dashboards: 12_450_000 → "$12,4 M". */
export function copCompact(amount: number): string {
  const n = Math.round(amount);
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(toMajor(n));
  const s = symbol();
  if (abs >= 1_000_000_000) return `${sign}${s}${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} MM`;
  if (abs >= 1_000_000) return `${sign}${s}${(abs / 1_000_000).toFixed(1).replace('.', ',')} M`;
  if (abs >= 10_000) return `${sign}${s}${Math.round(abs / 1000)} mil`;
  return cop(n);
}

export function num(n: number): string {
  return `${n < 0 ? '−' : ''}${group(n)}`;
}

export function decimal(n: number, digits = 1): string {
  return n.toFixed(digits).replace('.', ',');
}

export function km(n: number): string {
  // Always one decimal below 100 km so "km × price" in breakdowns adds up visibly.
  return `${decimal(n, n < 100 ? 1 : 0)} km`;
}

export function minutes(n: number): string {
  const m = Math.round(n);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function pct(n: number, digits = 0): string {
  return `${decimal(n, digits)} %`;
}

/** Parses user-typed money ("12.500", "$12500") into an integer. */
export function parseInteger(text: string): number {
  const digits = text.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

export function parseDecimal(text: string): number {
  const cleaned = text.replace(/[^\d.,]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function clock(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const suffix = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

export function shortDate(d: Date): string {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function dayLabel(d: Date, now = new Date()): string {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((b - a) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return shortDate(d);
}

export const weekdayShort = (d: Date) => DAYS[d.getDay()];
export const monthShort = (i: number) => MONTHS[i];

export function addMinutes(d: Date, m: number) {
  return new Date(d.getTime() + m * 60_000);
}
