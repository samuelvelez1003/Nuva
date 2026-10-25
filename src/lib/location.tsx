import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
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
  /** True once the GPS gave a real position (until then `here` is the fallback point). */
  fixed: boolean;
  /**
   * Permission granted but no position comes: the device can't locate itself (GPS off, or on
   * a computer the system's location service is off) or it timed out. Cleared by the next fix.
   */
  failed: boolean;
  /** Asks for permission (once per prompt) and starts the GPS; answers with the outcome. */
  request: () => Promise<Status>;
}

const Ctx = createContext<LocationState | null>(null);

interface Coords {
  latitude: number;
  longitude: number;
  heading?: number | null;
  accuracy?: number | null;
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('unknown');
  const [here, setHere] = useState<Place>(CURRENT_LOCATION);
  const [heading, setHeading] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [fixed, setFixed] = useState(false);
  const [failed, setFailed] = useState(false);
  const sub = useRef<{ remove: () => void } | null>(null);
  const lastGeocode = useRef<{ lat: number; lng: number; at: number } | null>(null);

  const onPosition = useCallback(async (c: Coords) => {
    const lat = c.latitude;
    const lng = c.longitude;
    if (c.heading != null && c.heading >= 0) setHeading(c.heading);
    setAccuracy(c.accuracy ?? null);
    setFixed(true);
    setFailed(false);
    setHere((h) => ({ ...h, id: 'current', kind: 'current', name: h.id === 'current' && h.name !== CURRENT_LOCATION.name ? h.name : 'Tu ubicación', lat, lng }));
    // Reverse-geocode at most every 60 s or 120 m (Nominatim usage policy).
    const lg = lastGeocode.current;
    const moved = lg ? Math.hypot((lat - lg.lat) * 110574, (lng - lg.lng) * 110954) : Infinity;
    if (!lg || moved > 120 || Date.now() - lg.at > 60_000) {
      lastGeocode.current = { lat, lng, at: Date.now() };
      const r = await reverseGeocode({ lat, lng });
      if (r) setHere((h) => ({ ...h, name: 'Tu ubicación', address: r.address || h.address, area: r.area || h.area }));
    }
  }, []);

  const startWatching = useCallback(async () => {
    sub.current?.remove();
    if (Platform.OS === 'web') {
      // The browser's own API, so its errors (no position, timeout) reach us; expo-location's
      // web version drops them and the app would wait on the fallback point forever.
      const geo = navigator.geolocation;
      const id = geo.watchPosition(
        (p) => onPosition(p.coords),
        (e) => {
          if (e.code !== e.PERMISSION_DENIED) setFailed(true);
          else setStatus('denied');
        },
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
      );
      sub.current = { remove: () => geo.clearWatch(id) };
      return;
    }
    sub.current = await Location.watchPositionAsync(
      // Every ~2 s / 5 m: frequent enough for the car to move smoothly on the other phone.
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 2000 },
      (pos) => onPosition(pos.coords),
      () => setFailed(true),
    );
  }, [onPosition]);

  const request = useCallback(async (): Promise<Status> => {
    const done = (s: Status) => {
      setStatus(s);
      return s;
    };
    try {
      const enabled = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!enabled) return done('unavailable');
      const { status: s, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (s !== 'granted') {
        // Blocked for good on the phone (the system won't ask again): open the app's settings.
        if (Platform.OS !== 'web' && !canAskAgain) Linking.openSettings().catch(() => {});
        return done('denied');
      }
      done('granted');
      setFailed(false);
      await startWatching();
      return 'granted';
    } catch {
      return done('unavailable');
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

  return <Ctx.Provider value={{ status, here, heading, accuracy, fixed, failed, request }}>{children}</Ctx.Provider>;
}

export function useLocation() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLocation must be used inside LocationProvider');
  return v;
}
