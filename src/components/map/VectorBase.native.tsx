import React, { memo, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Camera, MapTheme } from './CityMap';
import { vectorBackground, vectorMapHtml, vectorView } from './vectorMapHtml';

/** Native: the vector basemap in a WebView (Mapbox GL or MapLibre GL); the camera is pushed on every frame. */
export const VectorBase = memo(function VectorBase({ cam, w, h, theme }: { cam: Camera; w: number; h: number; theme: MapTheme }) {
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
        // Re-apply the latest camera once the page (and its map) is up.
        onLoadEnd={push}
      />
    </View>
  );
});
