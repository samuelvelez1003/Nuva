import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { MapPin, TriangleAlert } from 'lucide-react-native';
import { useT } from '../../i18n';
import type { Place } from '../../data/places';
import type { LatLng } from '../../lib/geo';
import { reverseGeocode } from '../../lib/geocode';
import { useLocation } from '../../lib/location';
import type { Country } from '../../lib/countries';
import { colors, radius, space } from '../../theme/tokens';
import { Button } from '../ui/Button';
import { Row } from '../ui/primitives';
import { Txt } from '../ui/Txt';

/** Point under the fixed pin and its street address (null while unknown). */
export interface PinState {
  point: LatLng | null;
  address: string | null;
  area: string;
  locating: boolean;
}

// Nominatim usage policy: at most one request per second, and nothing while the map
// still moves — the address is asked once the map has rested for a second.
const REST_MS = 1000;
const MIN_GAP_MS = 1100;
let lastCall = 0;
const cache = new Map<string, { address: string; area: string } | null>();
const keyOf = (c: LatLng) => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`;

/** Address of the point under the pin, reverse-geocoded (debounced, cached) when the map stops. */
export function usePinAddress() {
  const [pin, setPin] = useState<PinState>({ point: null, address: null, area: '', locating: false });
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  /** Starts on a known place (its address is already known: nothing is asked). */
  const reset = useCallback((point: LatLng, address: string | null, area = '') => {
    stop();
    seq.current++;
    setPin({ point, address, area, locating: false });
  }, []);

  /** The map stopped with `c` under the pin. */
  const move = useCallback((c: LatLng) => {
    stop();
    const my = ++seq.current;
    const known = cache.get(keyOf(c));
    if (known !== undefined) return setPin({ point: c, address: known?.address ?? null, area: known?.area ?? '', locating: false });
    setPin({ point: c, address: null, area: '', locating: true });
    timer.current = setTimeout(async () => {
      const wait = lastCall + MIN_GAP_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (my !== seq.current) return; // moved again meanwhile
      lastCall = Date.now();
      const r = await reverseGeocode(c);
      cache.set(keyOf(c), r);
      if (my === seq.current) setPin({ point: c, address: r?.address ?? null, area: r?.area ?? '', locating: false });
    }, REST_MS);
  }, []);

  return { pin, reset, move };
}

/**
 * "Mi ubicación" button of the pin mode: calls `onFix` with the phone's position — at
 * once when there is a GPS fix, otherwise after asking for location (once it arrives).
 * `onFail` when location stays off. Nothing happens once `active` is false.
 */
export function useLocateMe(active: boolean, onFix: (here: Place) => void, onFail: () => void) {
  const location = useLocation();
  const hasFix = location.status === 'granted' && location.fixed;
  // Waiting for the position after the button: none → asking (prompt open) → asked.
  const pending = useRef<'none' | 'asking' | 'asked'>('none');
  const [answered, setAnswered] = useState(0);
  const latest = useRef({ onFix, onFail, here: location.here });
  useEffect(() => {
    latest.current = { onFix, onFail, here: location.here };
  });
  useEffect(() => {
    const p = pending.current;
    if (p === 'none') return;
    if (!active) {
      pending.current = 'none';
    } else if (hasFix) {
      pending.current = 'none';
      latest.current.onFix(latest.current.here);
    } else if (p === 'asked' && (location.status !== 'granted' || location.failed)) {
      pending.current = 'none';
      latest.current.onFail();
    }
  }, [answered, hasFix, location.status, location.failed, active]);
  return () => {
    if (hasFix) return onFix(location.here);
    pending.current = 'asking';
    location.request().finally(() => {
      if (pending.current === 'asking') pending.current = 'asked';
      setAnswered((n) => n + 1);
    });
  };
}

/** Inside the country's service area (the lat/lng box the app searches and draws)? */
export const inServiceArea = (c: LatLng, b: Country['bounds']) => c.lat >= b.minLat && c.lat <= b.maxLat && c.lng >= b.minLng && c.lng <= b.maxLng;

/**
 * Panel of the map-pin mode: what to do, the address under the pin (live), a warning
 * when the point is outside the service area, confirm and cancel.
 */
export function PinPanel({
  title,
  pin,
  outOfZone,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  pin: PinState;
  /** Warning text when the point is outside the service area. */
  outOfZone?: string | null;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
      <View>
        <Txt v="h3">{title}</Txt>
        <Txt v="caption" color={colors.inkMuted}>
          {t('pax.pin.hint')}
        </Txt>
      </View>
      <Row style={{ gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.ivory100 }} accessibilityLiveRegion="polite">
        {pin.locating ? <ActivityIndicator size="small" color={colors.ink} /> : <MapPin size={18} color={colors.ink} />}
        <Txt v="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>
          {pin.locating ? t('pax.pin.locating') : pin.address || t('pax.pin.point')}
        </Txt>
      </Row>
      {outOfZone ? (
        <Row style={{ gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: radius.md, backgroundColor: colors.warningSoft }} accessibilityRole="alert">
          <TriangleAlert size={16} color={colors.warningInk} style={{ marginTop: 1 }} />
          <Txt v="caption" color={colors.warningInk} style={{ flex: 1 }}>
            {outOfZone}
          </Txt>
        </Row>
      ) : null}
      <Button label={confirmLabel} variant="dark" disabled={pin.locating || !pin.point} onPress={onConfirm} />
      <Button label={t('common.cancel')} variant="ghost" size="md" onPress={onCancel} />
    </View>
  );
}
