import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, GestureResponderEvent, LayoutChangeEvent, PanResponder, Platform, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { RotateCw, TriangleAlert } from 'lucide-react-native';
import { useT } from '../../i18n';
import { bbox, LatLng, MAP_H, MAP_W, project, Pt, unitsPerDegree, unproject } from '../../lib/geo';
import { isPlaceholderRoute } from '../../lib/routing';
import { colors, radius, shadow } from '../../theme/tokens';
import { Tap } from '../ui/Button';
import { Txt } from '../ui/Txt';
import { VectorBase } from './VectorBase';
import { MapRoute, VECTOR_ATTRIBUTION } from './vectorMapHtml';

// ─── Themes (overlay colours; the basemap and the route are the vector map below) ─

export type MapTheme = 'light' | 'dark';

// light = "Aurora" (passenger, web), dark = "Aurora · noche" (driver).
const THEMES = {
  light: { land: '#EAF0F1', pin: '#0E1B24', pinRing: '#FFFFFF', pinDot: '#5B4BD6', hot: '#5B4BD6', attribution: 'rgba(14,27,36,0.55)' },
  dark: { land: '#0B161E', pin: '#0E7C74', pinRing: '#0B161E', pinDot: '#FFFFFF', hot: '#A99BF5', attribution: 'rgba(246,249,249,0.45)' },
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

/** CityMap scale (px per map unit) for a basemap zoom level (512-px tiles, see vectorView). */
const scaleForZoom = (z: number) => (512 * Math.pow(2, z)) / (unitsPerDegree() * 360);
/** Zoom range the passenger can reach by hand: the whole metro area … one house. */
const MIN_ZOOM = 10.5;
const MAX_ZOOM = 19.5;

type ScreenPt = { x: number; y: number };

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
   * Pin mode: the map can be dragged and zoomed under a pin fixed at the centre of the
   * visible area (inside the insets). Called with that point whenever the map stops.
   */
  onPinMove?: (center: LatLng) => void;
  /**
   * Free map: drag to pan, pinch (touch) or wheel / trackpad (web) to zoom. The view
   * stays where the passenger left it until `focus` or `recenterKey` changes.
   */
  interactive?: boolean;
  /** Changing it drops the passenger's own view and frames `focus` again (recenter button). */
  recenterKey?: string | number;
  /** true once the passenger moved the map by hand; false when it is framed again. */
  onUserMove?: (moved: boolean) => void;
  /**
   * State of the street route: `loading` shows a subtle "calculating" pill (only the
   * markers are on the map meanwhile), `failed` an explicit message with a retry.
   */
  routeStatus?: 'loading' | 'failed' | 'ready';
  onRetryRoute?: () => void;
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
  interactive = false,
  recenterKey,
  onUserMove,
  routeStatus,
  onRetryRoute,
}: CityMapProps) {
  const tr = useT();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const pad: Insets = { top: 80, bottom: 80, left: 40, right: 40, ...insets };
  const focusKey = focus.map((p) => { const q = toPt(p); return `${q.x.toFixed(0)},${q.y.toFixed(0)}`; }).join('|');
  const target = useMemo(
    () => (size ? fitCamera(focus.map(toPt), size, pad, minSpan) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size?.w, size?.h, focusKey, pad.top, pad.bottom, pad.left, pad.right, minSpan],
  );
  const t = THEMES[theme];
  const pinMode = !!onPinMove;
  const gestures = pinMode || interactive;
  /** Screen point of the pin (and of zoom in pin mode): centre of the area left free by the insets. */
  const pinPx = size ? { left: pad.left + (size.w - pad.left - pad.right) / 2, top: pad.top + (size.h - pad.top - pad.bottom) / 2 } : null;

  // ── Camera: framed on `focus` (animated), or wherever the passenger moved it ──
  const [cam, setCamState] = useState<Camera | null>(null);
  const camRef = useRef<Camera | null>(null);
  const setCam = (c: Camera) => {
    camRef.current = c;
    setCamState(c);
  };
  const raf = useRef<number | null>(null);
  const stopAnim = () => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
  };
  /** The passenger moved the map by hand: it no longer follows `focus` until re-framed. */
  const detached = useRef(false);
  const onUserMoveRef = useRef(onUserMove);
  const onPinMoveRef = useRef(onPinMove);
  useEffect(() => {
    onUserMoveRef.current = onUserMove;
    onPinMoveRef.current = onPinMove;
  });
  const anchorRef = useRef(pinPx);
  const lastAnchor = useRef(pinPx);
  // Once moved by hand the map stays put (like Google Maps) until the screen asks to frame
  // it again: a new phase, another pin target, or the recenter button.
  const resetSig = String(recenterKey ?? '');
  const lastReset = useRef(resetSig);
  const targetKey = target ? `${target.x.toFixed(1)}|${target.y.toFixed(1)}|${target.s.toFixed(4)}` : '';

  useEffect(() => {
    if (!target) return;
    const reset = lastReset.current !== resetSig;
    lastReset.current = resetSig;
    const a0 = lastAnchor.current;
    lastAnchor.current = pinPx;
    anchorRef.current = pinPx;
    const start = camRef.current;
    // Asked to frame `focus` again: the passenger's own view is dropped.
    if (reset && detached.current) {
      detached.current = false;
      onUserMoveRef.current?.(false);
    }
    if (detached.current) {
      // Only the free area changed (a panel lowered or raised): keep the point the
      // passenger left at its centre — under the pin in pin mode.
      if (start && a0 && pinPx) setCam({ ...start, x: start.x + (a0.left - pinPx.left) / start.s, y: start.y + (a0.top - pinPx.top) / start.s });
      return;
    }
    if (!start) return setCam(target);
    const t0 = Date.now();
    const step = () => {
      const k = ease(Math.min(1, (Date.now() - t0) / 650));
      setCam({ x: start.x + (target.x - start.x) * k, y: start.y + (target.y - start.y) * k, s: start.s + (target.s - start.s) * k });
      raf.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    stopAnim();
    raf.current = requestAnimationFrame(step);
    return stopAnim;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, resetSig]);

  /** Keeps the centre inside the country's area (with a margin) and the zoom in range. */
  const clampCam = (c: Camera): Camera => {
    const a = anchorRef.current ?? { left: 0, top: 0 };
    const s = Math.min(scaleForZoom(MAX_ZOOM), Math.max(scaleForZoom(MIN_ZOOM), c.s));
    const cx = Math.min(MAP_W * 1.25, Math.max(-MAP_W * 0.25, c.x + a.left / c.s));
    const cy = Math.min(MAP_H * 1.25, Math.max(-MAP_H * 0.25, c.y + a.top / c.s));
    return { s, x: cx - a.left / s, y: cy - a.top / s };
  };
  const markMoved = () => {
    stopAnim();
    if (!detached.current) {
      detached.current = true;
      onUserMoveRef.current?.(true);
    }
  };
  /** The map stopped: in pin mode, report the point now under the pin. */
  const moveEnd = () => {
    const c = camRef.current;
    const a = anchorRef.current;
    if (!c || !a || !onPinMoveRef.current) return;
    onPinMoveRef.current(unproject({ x: c.x + a.left / c.s, y: c.y + a.top / c.s }));
  };

  // ── Drag (one finger / mouse) and pinch (two fingers) ──
  const g0 = useRef<{ cam: Camera; mid: ScreenPt; dist: number; n: number; off: ScreenPt; moved: boolean } | null>(null);
  const pinchPts = (e: GestureResponderEvent, off: ScreenPt): ScreenPt[] => {
    const ts = e.nativeEvent.touches;
    const pts = ts && ts.length ? Array.from(ts).slice(0, 2).map((p) => ({ x: p.pageX - off.x, y: p.pageY - off.y })) : [];
    return pts.length ? pts : [{ x: e.nativeEvent.pageX - off.x, y: e.nativeEvent.pageY - off.y }];
  };
  const rebase = (pts: ScreenPt[], off: ScreenPt, moved: boolean) => {
    const c = camRef.current;
    if (!c) return;
    const mid = pts.length > 1 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0];
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    g0.current = { cam: c, mid, dist, n: pts.length, off, moved };
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
        onPanResponderGrant: (e) => {
          // Page → map-view coordinates, from the first touch (its locationX is relative to the map).
          const off = { x: e.nativeEvent.pageX - e.nativeEvent.locationX, y: e.nativeEvent.pageY - e.nativeEvent.locationY };
          rebase(pinchPts(e, off), off, false);
        },
        onPanResponderMove: (e) => {
          const g = g0.current;
          if (!g) return;
          const pts = pinchPts(e, g.off);
          if (pts.length !== g.n) return rebase(pts, g.off, g.moved); // a finger added or lifted
          const mid = pts.length > 1 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0];
          const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
          if (!g.moved && Math.hypot(mid.x - g.mid.x, mid.y - g.mid.y) < 3 && Math.abs(dist - g.dist) < 3) return;
          g.moved = true;
          markMoved();
          const s0 = g.cam.s;
          const s = g.n > 1 && g.dist > 10 ? s0 * (dist / g.dist) : s0;
          const a = anchorRef.current;
          if (pinMode && a) {
            // Pin mode: pan with the fingers, zoom around the pin (the point under it stays put).
            const ax = g.cam.x + a.left / s0 - (mid.x - g.mid.x) / s0;
            const ay = g.cam.y + a.top / s0 - (mid.y - g.mid.y) / s0;
            setCam(clampCam({ s, x: ax - a.left / s, y: ay - a.top / s }));
          } else {
            // Free map: the point under the fingers stays under them.
            const mx = g.cam.x + g.mid.x / s0;
            const my = g.cam.y + g.mid.y / s0;
            setCam(clampCam({ s, x: mx - mid.x / s, y: my - mid.y / s }));
          }
        },
        onPanResponderRelease: () => {
          if (g0.current?.moved) moveEnd();
          g0.current = null;
        },
        onPanResponderTerminate: () => {
          if (g0.current?.moved) moveEnd();
          g0.current = null;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pinMode],
  );

  // ── Web: mouse wheel / trackpad pinch zooms (around the cursor, or the pin) ──
  const host = useRef<View>(null);
  const hasSize = !!size;
  useEffect(() => {
    if (Platform.OS !== 'web' || !gestures || !hasSize) return;
    const el = host.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (ev: WheelEvent) => {
      const c = camRef.current;
      if (!c) return;
      ev.preventDefault();
      markMoved();
      const r = el.getBoundingClientRect();
      const a = anchorRef.current;
      const p = pinMode && a ? { x: a.left, y: a.top } : { x: ev.clientX - r.left, y: ev.clientY - r.top };
      const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaMode === 2 ? ev.deltaY * 400 : ev.deltaY;
      const s = c.s * Math.exp(-dy * (ev.ctrlKey ? 0.01 : 0.002));
      const mx = c.x + p.x / c.s;
      const my = c.y + p.y / c.s;
      setCam(clampCam({ s, x: mx - p.x / s, y: my - p.y / s }));
      if (timer) clearTimeout(timer);
      timer = setTimeout(moveEnd, 250);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gestures, pinMode, hasSize]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1) setSize({ w: width, h: height });
  };

  const toScreen = (p: LatLng | Pt) => {
    const q = toPt(p);
    return cam ? { left: (q.x - cam.x) * cam.s, top: (q.y - cam.y) * cam.s } : { left: -999, top: -999 };
  };

  // The map draws the route itself (glued to the roads, under the street names).
  // A two-point route is the straight-line placeholder used while the street route
  // loads (or when it failed): it is never drawn, only the markers show.
  const mapRoute = useMemo<MapRoute | undefined>(
    () =>
      route && !isPlaceholderRoute(route)
        ? {
            coords: route.map((p) => {
              const ll = unproject(p);
              return [ll.lng, ll.lat] as [number, number];
            }),
            provisional: false,
          }
        : undefined,
    [route],
  );
  const status = routeStatus === 'failed' ? 'failed' : routeStatus === 'loading' ? 'loading' : null;

  return (
    <View ref={host} style={[{ flex: 1, overflow: 'hidden', backgroundColor: t.land }, style]} onLayout={onLayout} accessibilityLabel="Mapa" accessible>
      {size && cam ? (
        <>
          {/* Vector basemap (NÜVA minimal styles); it carries its own neighbourhood names. */}
          <VectorBase cam={cam} w={size.w} h={size.h} theme={theme} route={mapRoute} progress={progress} />
          <Svg width={size.w} height={size.h} viewBox={`${cam.x} ${cam.y} ${size.w / cam.s} ${size.h / cam.s}`} style={{ position: 'absolute' }} pointerEvents="none">
            <Defs>
              <RadialGradient id="hot" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={t.hot} stopOpacity={0.55} />
                <Stop offset="0.6" stopColor={t.hot} stopOpacity={0.16} />
                <Stop offset="1" stopColor={t.hot} stopOpacity={0} />
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
          {gestures ? (
            // Drag / pinch surface over the whole map (markers aren't touchable).
            // collapsable={false} + a (transparent) background: on phones an empty view is
            // flattened away by the native renderer and then never receives the touches.
            <View
              {...pan.panHandlers}
              collapsable={false}
              style={[
                { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.001)' },
                // Web: the browser must not scroll or zoom the page while the map is dragged.
                { cursor: 'grab', touchAction: 'none', userSelect: 'none' } as object,
              ]}
            />
          ) : null}
          {pinMode && pinPx ? (
            <View pointerEvents="none" style={{ position: 'absolute', left: pinPx.left - 16, top: pinPx.top - 44, width: 32, alignItems: 'center' }}>
              <View style={[{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.pin, borderWidth: 4, borderColor: t.pinRing, alignItems: 'center', justifyContent: 'center' }, shadow.soft]}>
                <View style={{ width: 9, height: 9, borderRadius: 2.5, backgroundColor: t.pinDot }} />
              </View>
              <View style={{ width: 3, height: 12, backgroundColor: t.pin, borderRadius: 2 }} />
              {/* Exact point: a small shadow on the ground under the pin's tip. */}
              <View style={{ width: 10, height: 4, borderRadius: 5, backgroundColor: 'rgba(14,27,36,0.28)', marginTop: -1 }} />
            </View>
          ) : null}
          {status ? (
            <View
              pointerEvents="box-none"
              style={{ position: 'absolute', left: 16, right: 16, top: Math.max(8, Math.min(size.h - pad.bottom - 52, pad.top + 4)), alignItems: 'center' }}
            >
              <View
                accessibilityLiveRegion="polite"
                accessibilityRole={status === 'failed' ? 'alert' : 'text'}
                style={[
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: theme === 'dark' ? colors.midnight700 : colors.white,
                    borderRadius: radius.pill,
                    paddingLeft: 14,
                    paddingRight: status === 'failed' && onRetryRoute ? 6 : 14,
                    minHeight: 40,
                    maxWidth: 420,
                  },
                  shadow.soft,
                ]}
              >
                {status === 'loading' ? (
                  <ActivityIndicator size="small" color={theme === 'dark' ? colors.limeOnDark : colors.midnight} />
                ) : (
                  <TriangleAlert size={16} color={theme === 'dark' ? colors.limeOnDark : colors.limeInk} />
                )}
                <Txt v="smallStrong" color={theme === 'dark' ? colors.onDark : colors.ink} style={{ flexShrink: 1 }}>
                  {status === 'loading' ? tr('route.loading') : tr('route.failed')}
                </Txt>
                {status === 'failed' && onRetryRoute ? (
                  <Tap
                    onPress={onRetryRoute}
                    accessibilityLabel={tr('route.retry')}
                    hitSlop={4}
                    style={{ minHeight: 34, borderRadius: radius.pill, paddingHorizontal: 12, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <RotateCw size={14} color={colors.onLime} strokeWidth={2.4} />
                    <Txt v="smallStrong" color={colors.onLime}>
                      {tr('route.retry')}
                    </Txt>
                  </Tap>
                ) : null}
              </View>
            </View>
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
