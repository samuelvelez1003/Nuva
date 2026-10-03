import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { CURRENT_LOCATION, Place } from '../data/places';
import { reverseGeocode } from './geocode';

/**
 * Device location for the whole app. Asks permission once; while granted,
 * keeps a live position and a human address. Falls back to Plaza de Bolívar
 * (Pereira) so every screen always has a usable point.
 */

type Status = 'unknown' | 'granted' | 'denied' | 'unavailable';

interface LocationState {
  status: Status;
  /** Current position as a pickup-ready Place (fallback when not granted). */
  here: Place;
  heading: number;
  accuracy: number | null;
  request: () => Promise<void>;
}

const Ctx = createContext<LocationState | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('unknown');
  const [here, setHere] = useState<Place>(CURRENT_LOCATION);
  const [heading, setHeading] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const sub = useRef<Location.LocationSubscription | null>(null);
  const lastGeocode = useRef<{ lat: number; lng: number; at: number } | null>(null);

  const startWatching = useCallback(async () => {
    sub.current?.remove();
    sub.current = await Location.watchPositionAsync(
      // Every ~2 s / 5 m: frequent enough for the car to move smoothly on the other phone.
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 2000 },
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (pos.coords.heading != null && pos.coords.heading >= 0) setHeading(pos.coords.heading);
        setAccuracy(pos.coords.accuracy ?? null);
        setHere((h) => ({ ...h, id: 'current', kind: 'current', name: h.id === 'current' && h.name !== CURRENT_LOCATION.name ? h.name : 'Tu ubicación', lat, lng }));
        // Reverse-geocode at most every 60 s or 120 m (Nominatim usage policy).
        const lg = lastGeocode.current;
        const moved = lg ? Math.hypot((lat - lg.lat) * 110574, (lng - lg.lng) * 110954) : Infinity;
        if (!lg || moved > 120 || Date.now() - lg.at > 60_000) {
          lastGeocode.current = { lat, lng, at: Date.now() };
          const r = await reverseGeocode({ lat, lng });
          if (r) setHere((h) => ({ ...h, name: 'Tu ubicación', address: r.address || h.address, area: r.area || h.area }));
        }
      },
    );
  }, []);

  const request = useCallback(async () => {
    try {
      const enabled = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!enabled) return setStatus('unavailable');
      const { status: s } = await Location.requestForegroundPermissionsAsync();
      if (s !== 'granted') return setStatus('denied');
      setStatus('granted');
      await startWatching();
    } catch {
      setStatus('unavailable');
    }
  }, [startWatching]);

  useEffect(() => {
    // Only auto-start if permission was already given (no prompt on launch).
    Location.getForegroundPermissionsAsync()
      .then((p) => {
        if (p.status === 'granted') {
          setStatus('granted');
          startWatching();
        }
      })
      .catch(() => {});
    return () => sub.current?.remove();
  }, [startWatching]);

  return <Ctx.Provider value={{ status, here, heading, accuracy, request }}>{children}</Ctx.Provider>;
}

export function useLocation() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLocation must be used inside LocationProvider');
  return v;
}
