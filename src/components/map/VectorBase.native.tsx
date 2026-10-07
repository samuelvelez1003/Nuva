import React, { memo, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Camera, MapTheme } from './CityMap';
import { MapRoute, vectorBackground, vectorMapHtml, vectorView } from './vectorMapHtml';

/**
 * Native: the vector basemap in a WebView (Mapbox GL or MapLibre GL). The camera is
 * pushed on every frame; the route only when it changes (it can be long), its
 * progress as a single number.
 */
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
  const web = useRef<WebView>(null);
  const v = vectorView(cam, w, h);
  const latest = useRef(v);
  latest.current = v;
  // The document is built once per theme; later moves go through window.__view.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => vectorMapHtml(theme, v), [theme]);
  const push = () => {
    const c = latest.current;
    web.current?.injectJavaScript(`window.__view&&window.__view(${c.lng},${c.lat},${c.zoom});true;`);
  };

  useEffect(push, [v.lng, v.lat, v.zoom]);

  const routeRef = useRef(route);
  routeRef.current = route;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const pushRoute = () => {
    const r = routeRef.current;
    web.current?.injectJavaScript(`window.__route&&window.__route(${JSON.stringify(r?.coords ?? [])},${!!r?.provisional});true;`);
  };
  const pushProgress = () => web.current?.injectJavaScript(`window.__progress&&window.__progress(${progressRef.current});true;`);
  useEffect(pushRoute, [route]);
  useEffect(pushProgress, [progress]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, backgroundColor: vectorBackground(theme) }}>
      <WebView
        ref={web}
        source={{ html, baseUrl: 'https://nuva.expo.app' }}
        originWhitelist={['*']}
        style={{ flex: 1, backgroundColor: vectorBackground(theme) }}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        javaScriptEnabled
        // Re-apply the latest camera and route once the page is up.
        onLoadEnd={() => {
          push();
          pushRoute();
          pushProgress();
        }}
      />
    </View>
  );
});
