import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { bbox, LatLng, MAP_H, MAP_W, project, Pt, unproject } from '../../lib/geo';
import { Txt } from '../ui/Txt';
import { VectorBase } from './VectorBase';
import { MapRoute, VECTOR_ATTRIBUTION } from './vectorMapHtml';

// ─── Themes (overlay colours; the basemap and the route are the vector map below) ─

export type MapTheme = 'light' | 'dark';

// light = "Esencial · Marfil" (passenger), dark = "Esencial · Medianoche" (driver).
const THEMES = {
  light: { land: '#F5F6F0', route: '#101411', attribution: 'rgba(16,20,17,0.4)' },
  dark: { land: '#101411', route: '#D4FF5F', attribution: 'rgba(245,246,240,0.35)' },
} as const;

// ─── Camera ──────────────────────────────────────────────────────────────

export interface Camera {
  x: number; // viewBox origin (map units, 1 = 10 m)
  y: number;
  s: number; // px per map unit
}

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function fitCamera(points: Pt[], size: { w: number; h: number }, insets: Insets, minSpan: number): Camera {
  const b = bbox(points);
  const innerW = Math.max(40, size.w - insets.left - insets.right);
  const innerH = Math.max(40, size.h - insets.top - insets.bottom);
  const spanW = Math.max(b.w, minSpan);
  const spanH = Math.max(b.h, minSpan * (innerH / innerW));
  const s = Math.min(innerW / spanW, innerH / spanH);
  return {
    s,
    x: b.cx - (insets.left + innerW / 2) / s,
    y: b.cy - (insets.top + innerH / 2) / s,
  };
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function useAnimatedCamera(target: Camera | null, duration = 650) {
  const [cam, setCam] = useState<Camera | null>(target);
  const from = useRef<Camera | null>(target);
  const raf = useRef<number | null>(null);
  const key = target ? `${target.x.toFixed(1)}|${target.y.toFixed(1)}|${target.s.toFixed(4)}` : '';

  useEffect(() => {
    if (!target) return;
    const start = from.current;
    if (!start) {
      from.current = target;
      setCam(target);
      return;
    }
    const t0 = Date.now();
    const step = () => {
      const k = ease(Math.min(1, (Date.now() - t0) / duration));
      const c = {
        x: start.x + (target.x - start.x) * k,
        y: start.y + (target.y - start.y) * k,
        s: start.s + (target.s - start.s) * k,
      };
      from.current = c;
      setCam(c);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return cam;
}

// ─── Public component ───────────────────────────────────────────────────

export interface Hotspot {
  center: LatLng;
  radius: number; // metres
  intensity: number; // 0..1
}

export interface CityMapProps {
  theme?: MapTheme;
  /** Points (lat/lng or projected) that must stay visible. */
  focus: (LatLng | Pt)[];
  /** Minimum visible span in map units (10 m). Controls max zoom. */
  minSpan?: number;
  insets?: Partial<Insets>;
  route?: Pt[];
  /** 0..1 — part of the route already travelled (drawn muted). */
  progress?: number;
  hotspots?: Hotspot[];
  style?: StyleProp<ViewStyle>;
  /** Render-prop for markers, given a projector from map space to screen px. */
  renderMarkers?: (toScreen: (p: LatLng | Pt) => { left: number; top: number }, cam: Camera) => React.ReactNode;
  /**
   * Pin mode: the map can be dragged under a pin fixed at the centre of the visible
   * area (inside the insets). Called with that point whenever a drag ends.
   */
  onPinMove?: (center: LatLng) => void;
}

const toPt = (p: LatLng | Pt): Pt => ('lat' in p ? project(p) : p);

export function CityMap({
  theme = 'light',
  focus,
  minSpan = 260,
  insets,
  route,
  progress = 0,
  hotspots,
  style,
  renderMarkers,
  onPinMove,
}: CityMapProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const pad: Insets = { top: 80, bottom: 80, left: 40, right: 40, ...insets };
  const focusKey = focus.map((p) => { const q = toPt(p); return `${q.x.toFixed(0)},${q.y.toFixed(0)}`; }).join('|');
  const target = useMemo(
    () => (size ? fitCamera(focus.map(toPt), size, pad, minSpan) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size?.w, size?.h, focusKey, pad.top, pad.bottom, pad.left, pad.right, minSpan],
  );
  const fitted = useAnimatedCamera(target);
  const t = THEMES[theme];

  // ── Pin mode: drag offset (screen px) added on top of the fitted camera ──
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const dragBase = useRef({ dx: 0, dy: 0 });
  useEffect(() => {
    // A new focus (e.g. another pickup) recentres the map.
    dragBase.current = { dx: 0, dy: 0 };
    setDrag({ dx: 0, dy: 0 });
  }, [focusKey]);
  const cam = fitted && onPinMove ? { ...fitted, x: fitted.x - drag.dx / fitted.s, y: fitted.y - drag.dy / fitted.s } : fitted;
  /** Screen point of the pin: centre of the area left free by the insets. */
  const pinPx = size ? { left: pad.left + (size.w - pad.left - pad.right) / 2, top: pad.top + (size.h - pad.top - pad.bottom) / 2 } : null;
  const camRef = useRef(cam);
  camRef.current = cam;
  const pinCenter = () => {
    const c = camRef.current;
    if (!c || !pinPx) return null;
    return unproject({ x: c.x + pinPx.left / c.s, y: c.y + pinPx.top / c.s });
  };
  const onPinMoveRef = useRef(onPinMove);
  onPinMoveRef.current = onPinMove;
  /** End of a drag: keep the offset and report the point now under the pin. */
  const finish = (dx: number, dy: number) => {
    dragBase.current = { dx: dragBase.current.dx + dx, dy: dragBase.current.dy + dy };
    setDrag(dragBase.current);
    // Next frame, once the camera reflects the final offset.
    requestAnimationFrame(() => {
      const c = pinCenter();
      if (c) onPinMoveRef.current?.(c);
    });
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        // Don't hand the drag over to other gestures (e.g. iOS swipe-back) mid-way.
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderMove: (_e, g) => setDrag({ dx: dragBase.current.dx + g.dx, dy: dragBase.current.dy + g.dy }),
        onPanResponderRelease: (_e, g) => finish(g.dx, g.dy),
        onPanResponderTerminate: (_e, g) => finish(g.dx, g.dy),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pinPx?.left, pinPx?.top],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1) setSize({ w: width, h: height });
  };

  const toScreen = (p: LatLng | Pt) => {
    const q = toPt(p);
    return cam ? { left: (q.x - cam.x) * cam.s, top: (q.y - cam.y) * cam.s } : { left: -999, top: -999 };
  };

  // The map draws the route itself (glued to the roads, under the street names).
  // A two-point route is the straight-line placeholder shown while the street route
  // loads: the map draws it dashed, never as a road.
  const mapRoute = useMemo<MapRoute | undefined>(
    () =>
      route && route.length > 1
        ? {
            coords: route.map((p) => {
              const ll = unproject(p);
              return [ll.lng, ll.lat] as [number, number];
            }),
            provisional: route.length === 2,
          }
        : undefined,
    [route],
  );

  return (
    <View style={[{ flex: 1, overflow: 'hidden', backgroundColor: t.land }, style]} onLayout={onLayout} accessibilityLabel="Mapa" accessible>
      {size && cam ? (
        <>
          {/* Vector basemap (NÜVA minimal styles); it carries its own neighbourhood names. */}
          <VectorBase cam={cam} w={size.w} h={size.h} theme={theme} route={mapRoute} progress={progress} />
          <Svg width={size.w} height={size.h} viewBox={`${cam.x} ${cam.y} ${size.w / cam.s} ${size.h / cam.s}`} style={{ position: 'absolute' }} pointerEvents="none">
            <Defs>
              <RadialGradient id="hot" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#D4FF5F" stopOpacity={0.55} />
                <Stop offset="0.6" stopColor="#D4FF5F" stopOpacity={0.16} />
                <Stop offset="1" stopColor="#D4FF5F" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {hotspots?.map((h, i) => {
              const c = project(h.center);
              return <Circle key={i} cx={c.x} cy={c.y} r={h.radius / 10} fill="url(#hot)" opacity={0.35 + h.intensity * 0.65} />;
            })}
          </Svg>
          <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
            {renderMarkers?.(toScreen, cam)}
          </View>
          {onPinMove && pinPx ? (
            <>
              {/* Drag surface: the whole map moves under the fixed pin. */}
              {/* collapsable={false} + a (transparent) background: on phones an empty view is
                  flattened away by the native renderer and then never receives the touches. */}
              <View
                {...pan.panHandlers}
                collapsable={false}
                style={[{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.001)' }, { cursor: 'grab' } as object]}
              />
              <View pointerEvents="none" style={{ position: 'absolute', left: pinPx.left - 16, top: pinPx.top - 44, width: 32, alignItems: 'center' }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.route, borderWidth: 4, borderColor: '#D4FF5F', alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#D4FF5F' }} />
                </View>
                <View style={{ width: 3, height: 12, backgroundColor: t.route, borderRadius: 2 }} />
              </View>
            </>
          ) : null}
          <View pointerEvents="none" style={{ position: 'absolute', right: 6, bottom: 4 }}>
            <Txt style={{ fontSize: 9 }} color={t.attribution}>
              {VECTOR_ATTRIBUTION}
            </Txt>
          </View>
        </>
      ) : null}
    </View>
  );
}

export { MAP_W, MAP_H };
