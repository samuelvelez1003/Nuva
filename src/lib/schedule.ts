import type { TFunction } from '../i18n';
import { clock, shortDate } from './format';

/**
 * Scheduled trips: 30 minutes to 7 days ahead (the server enforces the same window),
 * picked in 15-minute slots. Times are the phone's local time (Colombia).
 */
export const SCHEDULE_MIN_AHEAD_MIN = 30;
export const SCHEDULE_MAX_AHEAD_DAYS = 7;
const SLOT_MIN = 15;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Earliest pickup that can be scheduled: now + 30 min, rounded up to the next 15-minute slot. */
export function earliestSlot(now = new Date()) {
  const d = new Date(now.getTime() + SCHEDULE_MIN_AHEAD_MIN * 60_000);
  d.setSeconds(0, 0);
  const extra = d.getMinutes() % SLOT_MIN;
  if (extra) d.setMinutes(d.getMinutes() + SLOT_MIN - extra);
  return d;
}

/** Latest pickup that can be scheduled (a minute of margin under the 7-day limit). */
const latestSlot = (now = new Date()) => new Date(now.getTime() + SCHEDULE_MAX_AHEAD_DAYS * 86_400_000 - 60_000);

/** Days with at least one free slot: today (if there's still time), tomorrow, … up to 7 days ahead. */
export function scheduleDays(now = new Date()): Date[] {
  const first = startOfDay(earliestSlot(now));
  const last = latestSlot(now);
  const out: Date[] = [];
  for (let d = first; d <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) out.push(d);
  return out;
}

/** The 15-minute slots of one day inside the allowed window. */
export function daySlots(day: Date, now = new Date()): Date[] {
  const from = Math.max(startOfDay(day).getTime(), earliestSlot(now).getTime());
  const end = Math.min(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime(), latestSlot(now).getTime() + 1);
  const out: Date[] = [];
  for (let ms = from; ms < end; ms += SLOT_MIN * 60_000) out.push(new Date(ms));
  return out;
}

/** "Hoy", "Mañana" or "vie 31 oct". */
export function dayName(d: Date, t: TFunction, now = new Date()) {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000);
  return diff === 0 ? t('pax.sched.today') : diff === 1 ? t('pax.sched.tomorrow') : shortDate(d);
}

/** "Mañana 7:30 a. m." */
export const whenLabel = (d: Date, t: TFunction) => `${dayName(d, t)} ${clock(d)}`;

/** Night in Bogotá time (19:00–05:00), whatever the phone's time zone. */
export function isNightBogota(d = new Date()) {
  const h = (d.getUTCHours() + 24 - 5) % 24;
  return h >= 19 || h < 5;
}
