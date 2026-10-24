/**
 * Formatting helpers. Written by hand instead of Intl so output is identical
 * on Hermes (iOS/Android) and on the web.
 *
 * Money amounts are integers in Colombian pesos (COP has no decimals):
 * 12600 → "$12.600". NÜVA only charges in COP.
 */

const group = (n: number) => Math.abs(Math.trunc(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const CURRENCY = { code: 'COP', symbol: '$' } as const;
/** The only currency: Colombian pesos ("$", code COP). */
export const moneyCurrency = () => CURRENCY;
const symbol = () => CURRENCY.symbol;
const body = (abs: number) => group(abs);

/** Money in Colombian pesos: "$12.600". */
export function cop(amount: number): string {
  const n = Math.round(amount);
  return `${n < 0 ? '−' : ''}${symbol()}${body(Math.abs(n))}`;
}

/** Signed variant for deltas: "+$1.200" / "−$800". */
export function copDelta(amount: number): string {
  const n = Math.round(amount);
  if (n === 0) return `${symbol()}0`;
  return `${n > 0 ? '+' : '−'}${symbol()}${body(Math.abs(n))}`;
}

/** Compact amounts for dashboards: 12_450_000 → "$12,4 M". */
export function copCompact(amount: number): string {
  const n = Math.round(amount);
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
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

/**
 * Dates follow the app language (set by LanguageProvider through setFormatLanguage).
 */
type DateWords = { days: string[]; months: string[]; today: string; yesterday: string; am: string; pm: string };
const DATE_WORDS: Record<'es' | 'en', DateWords> = {
  es: {
    days: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
    today: 'Hoy',
    yesterday: 'Ayer',
    am: 'a. m.',
    pm: 'p. m.',
  },
  en: {
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    today: 'Today',
    yesterday: 'Yesterday',
    am: 'AM',
    pm: 'PM',
  },
};
let WORDS: DateWords = DATE_WORDS.es;
export function setFormatLanguage(lang: 'es' | 'en') {
  WORDS = DATE_WORDS[lang] ?? DATE_WORDS.es;
}

export function clock(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const suffix = h >= 12 ? WORDS.pm : WORDS.am;
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

export function shortDate(d: Date): string {
  return `${WORDS.days[d.getDay()]} ${d.getDate()} ${WORDS.months[d.getMonth()]}`;
}

export function dayLabel(d: Date, now = new Date()): string {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((b - a) / 86_400_000);
  if (diff === 0) return WORDS.today;
  if (diff === 1) return WORDS.yesterday;
  return shortDate(d);
}

export const weekdayShort = (d: Date) => WORDS.days[d.getDay()];
export const monthShort = (i: number) => WORDS.months[i];

export function addMinutes(d: Date, m: number) {
  return new Date(d.getTime() + m * 60_000);
}
