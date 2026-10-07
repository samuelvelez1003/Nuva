import React, { memo, useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { Camera, MapTheme } from './CityMap';
import { baseStyleUrl, MAP_LIB, MAP_OPTIONS, MapRoute, NUVA_ROUTE_JS, NUVA_STYLE_JS, themeColors, USE_MAPBOX, vectorBackground, vectorView } from './vectorMapHtml';

// Minimal typing for the map library global (Mapbox GL or MapLibre GL) loaded from the CDN.
interface MlMap {
  jumpTo(o: { center: [number, number]; zoom: number }): void;
  resize(): void;
  remove(): void;
}
type MapGlobal = { Map: new (o: Record<string, unknown>) => MlMap };

let lib: Promise<MapGlobal> | null = null;
/** Loads the map library (script + css) once per page. */
function loadMapLib(): Promise<MapGlobal> {
  if (lib) return lib;
  lib = new Promise((resolve, reject) => {
    const w = window as unknown as Record<string, MapGlobal | undefined>;
    const ready = w[MAP_LIB.global];
    if (ready) return resolve(ready);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = MAP_LIB.css;
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = MAP_LIB.js;
    s.onload = () => {
      const g = w[MAP_LIB.global];
      return g ? resolve(g) : reject(new Error('map library'));
    };
    s.onerror = () => {
      lib = null;
      reject(new Error('map library'));
    };
    document.head.appendChild(s);
  });
  return lib;
}

const baseStyles = new Map<MapTheme, Promise<Record<string, unknown>>>();
function fetchBaseStyle(theme: MapTheme) {
  let p = baseStyles.get(theme);
  if (!p) baseStyles.set(theme, (p = fetch(baseStyleUrl(theme)).then((r) => r.json())));
  return p;
}
// The same style code the native WebView runs.
const nuva = new Function(`${NUVA_STYLE_JS}; return nuva;`)() as (s: Record<string, unknown>, t: unknown, mapbox: boolean) => Record<string, unknown>;
type RouteLayer = { set(coords: [number, number][], provisional: boolean): void; progress(f: number): void };
const nuvaRoute = new Function(`${NUVA_ROUTE_JS}; return nuvaRoute;`)() as (map: MlMap, t: unknown) => RouteLayer;

/** Web: the map library draws straight into a div; the camera follows CityMap every frame. */
export const VectorBase = memo(function VectorBase({
  cam,
  w,
  h,
  theme,
  route,
  progress = 0,
}: {
  cam: Camera;
  w: number;
  h: number;
  theme: MapTheme;
  route?: MapRoute;
  progress?: number;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<MlMap | null>(null);
  const layer = useRef<RouteLayer | null>(null);
  const v = vectorView(cam, w, h);
  const latest = useRef({ v, route, progress });
  latest.current = { v, route, progress };

  useEffect(() => {
    let alive = true;
    Promise.all([loadMapLib(), fetchBaseStyle(theme)])
      .then(([ml, style]) => {
        if (!alive || !host.current) return;
        const c = latest.current.v;
        map.current = new ml.Map({
          ...MAP_OPTIONS,
          container: host.current,
          // Deep copy: the cached base style must stay untouched for the next mount.
          style: nuva(JSON.parse(JSON.stringify(style)), themeColors(theme), USE_MAPBOX),
          center: [c.lng, c.lat],
          zoom: c.zoom,
        });
        // The route is drawn by the map itself (see NUVA_ROUTE_JS).
        layer.current = nuvaRoute(map.current, themeColors(theme));
        layer.current.set(latest.current.route?.coords ?? [], !!latest.current.route?.provisional);
        layer.current.progress(latest.current.progress);
      })
      .catch(() => {});
    return () => {
      alive = false;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, [theme]);

  useEffect(() => {
    layer.current?.set(route?.coords ?? [], !!route?.provisional);
  }, [route]);

  useEffect(() => {
    layer.current?.progress(progress);
  }, [progress]);

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
