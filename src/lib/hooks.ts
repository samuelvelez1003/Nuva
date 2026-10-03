import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import type { TFunction } from '../i18n';
import { es } from '../i18n/es';

/** Increments every `ms` while the screen is focused. Drives map ambience. */
export function useTick(ms: number, enabled = true) {
  const [tick, setTick] = useState(0);
  const focused = useIsFocused();
  useEffect(() => {
    if (!enabled || !focused) return;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms, enabled, focused]);
  return tick;
}

/** Smooth 0→1 progress over `durationMs`, restarting when `key` changes. */
export function useProgress(durationMs: number, running: boolean, key: unknown = 0, onDone?: () => void) {
  const [p, setP] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    setP(0);
    if (!running) return;
    const t0 = Date.now();
    let fired = false;
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / durationMs);
      setP(k);
      if (k >= 1 && !fired) {
        fired = true;
        clearInterval(id);
        done.current?.();
      }
    }, 80);
    return () => clearInterval(id);
  }, [durationMs, running, key]);
  return p;
}

/** Whole-second countdown. */
export function useCountdown(seconds: number, running: boolean, key: unknown = 0, onEnd?: () => void) {
  const [left, setLeft] = useState(seconds);
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => {
    setLeft(seconds);
    if (!running) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const l = Math.max(0, seconds - (Date.now() - t0) / 1000);
      setLeft(l);
      if (l <= 0) {
        clearInterval(id);
        end.current?.();
      }
    }, 100);
    return () => clearInterval(id);
  }, [seconds, running, key]);
  return left;
}

/** Dictionary key of the time-of-day greeting. */
export function greetingKey(d = new Date()): 'common.greeting.morning' | 'common.greeting.afternoon' | 'common.greeting.evening' {
  const h = d.getHours();
  if (h < 12) return 'common.greeting.morning';
  if (h < 19) return 'common.greeting.afternoon';
  return 'common.greeting.evening';
}

/**
 * Time-of-day greeting. Pass the `t` from `useT()` to get it in the current
 * language; without it the Spanish text is returned (back-compat).
 */
export function greeting(d = new Date(), t?: TFunction) {
  const key = greetingKey(d);
  return t ? t(key) : es[key];
}
