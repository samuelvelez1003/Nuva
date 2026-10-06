import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, fonts, shadow } from '../../theme/tokens';
import { Txt } from '../ui/Txt';

type Pos = { left: number; top: number };

/** Places a child centred on a screen position. */
export function At({ pos, w, h, children, z = 1 }: { pos: Pos; w: number; h: number; children: React.ReactNode; z?: number }) {
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: pos.left - w / 2, top: pos.top - h / 2, width: w, height: h, zIndex: z, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}

/** Current location: Midnight ring, lime core, soft radar pulse. */
export function UserDot({ pos, tone = 'light' }: { pos: Pos; tone?: 'light' | 'dark' }) {
  const s = useSharedValue(0.4);
  useEffect(() => {
    s.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false);
  }, [s]);
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: 1 - s.value }));
  return (
    <At pos={pos} w={120} h={120} z={3}>
      <Animated.View
        style={[
          { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: tone === 'dark' ? 'rgba(212,255,95,0.25)' : 'rgba(16,20,17,0.14)' },
          pulse,
        ]}
      />
      <View style={[{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white }, shadow.soft]}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime }} />
      </View>
    </At>
  );
}

/** Speech-bubble label anchored above (or, with `below`, under) a pin. */
export function Bubble({
  title,
  sub,
  tone = 'dark',
  anchor = 'center',
  below = false,
}: {
  title: string;
  sub?: string;
  tone?: 'dark' | 'light' | 'lime';
  anchor?: 'center' | 'left' | 'right';
  below?: boolean;
}) {
  const bg = tone === 'dark' ? colors.midnight : tone === 'lime' ? colors.lime : colors.white;
  const fg = tone === 'dark' ? colors.ivory : colors.ink;
  const tip = { marginHorizontal: anchor === 'center' ? 0 : 18, width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent' };
  return (
    <View style={{ alignItems: anchor === 'left' ? 'flex-start' : anchor === 'right' ? 'flex-end' : 'center' }}>
      {below ? <View style={{ ...tip, borderBottomWidth: 6, borderBottomColor: bg }} /> : null}
      <View style={[{ backgroundColor: bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }, shadow.soft]}>
        {sub ? (
          <View style={{ backgroundColor: tone === 'dark' ? colors.lime : colors.midnight, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Txt v="caption" color={tone === 'dark' ? colors.midnight : colors.lime} style={{ fontFamily: fonts.extrabold }}>
              {sub}
            </Txt>
          </View>
        ) : null}
        <Txt v="smallStrong" color={fg} numberOfLines={1} style={{ maxWidth: 160 }}>
          {title}
        </Txt>
      </View>
      {below ? null : <View style={{ ...tip, borderTopWidth: 6, borderTopColor: bg }} />}
    </View>
  );
}

/**
 * How much of a screen polyline crosses a box, sampled every ~8 px (street
 * routes can have long straight segments with no vertex inside the box).
 */
function lineIn(line: Pos[], x0: number, x1: number, y0: number, y1: number) {
  let n = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.left - a.left, b.top - a.top) / 8));
    for (let k = 0; k <= steps; k++) {
      const x = a.left + ((b.left - a.left) * k) / steps;
      const y = a.top + ((b.top - a.top) * k) / steps;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) n++;
    }
  }
  return n;
}

/**
 * Pickup = ring, destination = lime square — mirrors the logo's umlaut.
 * `route` (screen points of the drawn route): the label goes under the pin when
 * the route arrives from above, so it never hides the way in.
 */
export function PlacePin({
  pos,
  kind,
  title,
  sub,
  tone = 'light',
  route,
}: {
  pos: Pos;
  kind: 'pickup' | 'dropoff';
  title?: string;
  sub?: string;
  tone?: 'light' | 'dark';
  route?: Pos[];
}) {
  const dark = tone === 'dark';
  // Keep the bubble on screen: anchor it left/right near the edges.
  const anchor = pos.left > 230 ? 'right' : pos.left < 110 ? 'left' : 'center';
  const [x0, x1] = anchor === 'right' ? [pos.left - 196, pos.left + 24] : anchor === 'left' ? [pos.left - 24, pos.left + 196] : [pos.left - 110, pos.left + 110];
  const below = !!title && !!route && route.length > 1 && lineIn(route, x0, x1, pos.top - 56, pos.top - 10) > lineIn(route, x0, x1, pos.top + 10, pos.top + 56);
  return (
    <>
      {title ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: below ? pos.top + 14 : pos.top - 54,
            left: x0,
            width: 220,
            zIndex: 4,
            alignItems: anchor === 'right' ? 'flex-end' : anchor === 'left' ? 'flex-start' : 'center',
          }}
        >
          <Animated.View entering={ZoomIn.springify().damping(14)}>
            <Bubble title={title} sub={sub} tone={dark ? 'light' : 'dark'} anchor={anchor} below={below} />
          </Animated.View>
        </View>
      ) : null}
      <At pos={pos} w={26} h={26} z={4}>
        {kind === 'pickup' ? (
          <View style={[{ width: 20, height: 20, borderRadius: 10, backgroundColor: dark ? colors.midnight : colors.white, borderWidth: 5, borderColor: dark ? colors.ivory : colors.midnight }, shadow.soft]} />
        ) : (
          <View style={[{ width: 20, height: 20, borderRadius: 5, backgroundColor: colors.lime, borderWidth: 3, borderColor: colors.midnight }, shadow.soft]} />
        )}
      </At>
    </>
  );
}

/** Top-down car. `heading` in degrees, 0 = north. */
export function CarMarker({ pos, heading = 0, tone = 'brand', size = 34 }: { pos: Pos; heading?: number; tone?: 'brand' | 'muted' | 'lime'; size?: number }) {
  const body = tone === 'lime' ? colors.lime : tone === 'muted' ? '#5E635D' : colors.midnight;
  const roof = tone === 'lime' ? colors.midnight : tone === 'muted' ? '#8B8F89' : colors.lime;
  return (
    <At pos={pos} w={size} h={size} z={tone === 'muted' ? 2 : 5}>
      <View style={{ transform: [{ rotate: `${heading}deg` }] }}>
        <Svg width={size * 0.56} height={size} viewBox="0 0 20 36">
          <Rect x={1} y={1} width={18} height={34} rx={7} fill={body} stroke={colors.white} strokeWidth={1.6} />
          <Path d="M4 11 Q10 8 16 11 L15 16 H5 Z" fill={roof} opacity={0.95} />
          <Rect x={5} y={18} width={10} height={8} rx={2} fill={roof} opacity={0.35} />
          <Path d="M5 30 Q10 32 15 30" stroke={roof} strokeWidth={1.4} fill="none" opacity={0.6} />
        </Svg>
      </View>
    </At>
  );
}
