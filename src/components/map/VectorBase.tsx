import React, { memo, useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { Camera, MapTheme } from './CityMap';
import { BASE_STYLE_URL, MAPLIBRE_CSS, MAPLIBRE_JS, NUVA_STYLE_JS, themeColors, vectorBackground, vectorView } from './vectorMapHtml';

// Minimal typing for the MapLibre global loaded from the CDN.
interface MlMap {
  jumpTo(o: { center: [number, number]; zoom: number }): void;
  resize(): void;
  remove(): void;
}
type MaplibreGlobal = { Map: new (o: Record<string, unknown>) => MlMap };

let lib: Promise<MaplibreGlobal> | null = null;
/** Loads MapLibre GL (script + css) once per page. */
function loadMaplibre(): Promise<MaplibreGlobal> {
  if (lib) return lib;
  lib = new Promise((resolve, reject) => {
    const w = window as unknown as { maplibregl?: MaplibreGlobal };
    if (w.maplibregl) return resolve(w.maplibregl);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = MAPLIBRE_CSS;
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = MAPLIBRE_JS;
    s.onload = () => (w.maplibregl ? resolve(w.maplibregl) : reject(new Error('maplibre')));
    s.onerror = () => {
      lib = null;
      reject(new Error('maplibre'));
    };
    document.head.appendChild(s);
  });
  return lib;
}

let baseStyle: Promise<Record<string, unknown>> | null = null;
const fetchBaseStyle = () => (baseStyle ??= fetch(BASE_STYLE_URL).then((r) => r.json()));
// The same style code the native WebView runs.
const nuva = new Function(`${NUVA_STYLE_JS}; return nuva;`)() as (s: Record<string, unknown>, t: unknown) => Record<string, unknown>;

/** Web: MapLibre draws straight into a div; the camera follows CityMap every frame. */
export const VectorBase = memo(function VectorBase({ cam, w, h, theme }: { cam: Camera; w: number; h: number; theme: MapTheme }) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<MlMap | null>(null);
  const v = vectorView(cam, w, h);
  const latest = useRef(v);
  latest.current = v;

  useEffect(() => {
    let alive = true;
    Promise.all([loadMaplibre(), fetchBaseStyle()])
      .then(([ml, style]) => {
        if (!alive || !host.current) return;
        const c = latest.current;
        map.current = new ml.Map({
          container: host.current,
          // Deep copy: the shared base style must stay untouched for the other theme.
          style: nuva(JSON.parse(JSON.stringify(style)), themeColors(theme)),
          center: [c.lng, c.lat],
          zoom: c.zoom,
          interactive: false,
          attributionControl: false,
          fadeDuration: 0,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
      map.current?.remove();
      map.current = null;
    };
  }, [theme]);

  useEffect(() => {
    map.current?.jumpTo({ center: [v.lng, v.lat], zoom: v.zoom });
  }, [v.lng, v.lat, v.zoom]);

  useEffect(() => {
    map.current?.resize();
  }, [w, h]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, backgroundColor: vectorBackground(theme) }}>
      {React.createElement('div', { ref: host, 'aria-hidden': true, style: { width: '100%', height: '100%', pointerEvents: 'none' } })}
    </View>
  );
});
