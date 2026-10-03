import { useEffect, useRef, useState } from 'react';
import { Pt } from './geo';

/**
 * Makes the car on the map move like a real car: snapped onto the street it is
 * driving on, and gliding between GPS fixes instead of jumping every few seconds.
 * Map units are the planar projection of geo.ts (1 unit = 10 m).
 */

export interface Snap {
  /** Closest point on the route. */
  pt: Pt;
  /** Fraction (0–1) of the route covered at that point. */
  fraction: number;
  /** Direction of the street there (degrees, 0 = north). */
  heading: number;
  /** Distance from the raw position to the route, in metres. */
  offM: number;
}

const headingOf = (p: Pt, q: Pt) => (Math.atan2(q.x - p.x, -(q.y - p.y)) * 180) / Math.PI;

/** Projects `p` onto the nearest segment of `route` (true segment projection, not just vertices). */
export function snapToRoute(route: Pt[], p: Pt): Snap | null {
  if (route.length < 2) return null;
  let total = 0;
  for (let i = 1; i < route.length; i++) total += Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
  if (!total) return null;
  let best: Snap | null = null;
  let acc = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const seg = Math.sqrt(len2);
    const k = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
    const pt = { x: a.x + dx * k, y: a.y + dy * k };
    const off = Math.hypot(p.x - pt.x, p.y - pt.y) * 10;
    if (!best || off < best.offM) best = { pt, fraction: (acc + seg * k) / total, heading: seg ? headingOf(a, b) : 0, offM: off };
    acc += seg;
  }
  return best;
}

/** Further than this from the route, the driver has left it: show the raw position and re-route. */
export const OFF_ROUTE_M = 45;

/** Shortest-turn interpolation between two headings. */
function lerpAngle(a: number, b: number, k: number) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * k;
}

/**
 * Smoothly animates towards `target` (≈ the interval between position updates),
 * so the marker glides along the street. Returns the position to draw.
 */
export function useGlide(target: (Pt & { heading: number }) | null, durationMs = 1600) {
  const [pos, setPos] = useState(target);
  const from = useRef(target);
  const cur = useRef(target);
  const key = target ? `${target.x.toFixed(2)},${target.y.toFixed(2)},${Math.round(target.heading)}` : '';

  useEffect(() => {
    if (!target) {
      cur.current = null;
      setPos(null);
      return;
    }
    const start = cur.current;
    // First fix, or a jump over 400 m (new route / reconnect): place it directly.
    if (!start || Math.hypot(target.x - start.x, target.y - start.y) > 40) {
      cur.current = target;
      setPos(target);
      return;
    }
    from.current = start;
    const t0 = Date.now();
    let raf = 0;
    const frame = () => {
      const k = Math.min(1, (Date.now() - t0) / durationMs);
      const e = k * (2 - k); // ease-out
      const p = {
        x: start.x + (target.x - start.x) * e,
        y: start.y + (target.y - start.y) * e,
        heading: lerpAngle(start.heading, target.heading, e),
      };
      cur.current = p;
      setPos(p);
      if (k < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, durationMs]);

  return pos;
}
