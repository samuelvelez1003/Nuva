import type { Place } from '../data/places';
import { activeCountry } from './region';
import { authStorage } from './storage';

/**
 * Places this passenger recently searched or chose (destinations and pickups),
 * kept on the device per country, so a typed address doesn't have to be found twice.
 */
const MAX = 6;
const keyFor = () => `nuva.recent.${activeCountry()}`;

export function getRecentPlaces(): Place[] {
  try {
    const raw = authStorage?.getItem(keyFor());
    const list = raw ? (JSON.parse(raw) as Place[]) : [];
    return Array.isArray(list) ? list.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)) : [];
  } catch {
    return [];
  }
}

export function addRecentPlace(p: Place) {
  // The phone's own position and saved places already have their own shortcuts.
  if (p.id === 'current' || p.kind === 'home' || p.kind === 'work' || p.kind === 'favorite') return;
  try {
    const same = (o: Place) => o.name.toLowerCase() === p.name.toLowerCase() && Math.abs(o.lat - p.lat) < 0.0007 && Math.abs(o.lng - p.lng) < 0.0007;
    const next = [{ ...p, kind: 'recent' as Place['kind'] }, ...getRecentPlaces().filter((o) => !same(o))].slice(0, MAX);
    authStorage?.setItem(keyFor(), JSON.stringify(next));
  } catch {
    // storage unavailable: recents are a convenience only
  }
}
