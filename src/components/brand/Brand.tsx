import React from 'react';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';
import { colors } from '../../theme/tokens';

/**
 * NÜVA wordmark v2 — refined geometric letterforms on a 100-unit cap height,
 * 16-unit stroke. The umlaut is a route: a hollow ring (origin) and a solid
 * lime dot (destination). The A drops its crossbar (Λ) and reads as forward.
 */
export const WORDMARK_PATHS = {
  N: 'M0 0H17L64 72V0H80V100H63L16 28V100H0Z',
  U: 'M94 0H110V60A24 24 0 0 0 158 60V0H174V60A40 40 0 0 1 94 60Z',
  V: 'M188 0H205L230 76L255 0H272L240 100H220Z',
  A: 'M316 0H336L368 100H351L326 22L301 100H284Z',
};

/** Geometry shared with the splash animation (viewBox units). */
export const WORDMARK = {
  vbX: 0,
  vbY: -38,
  vbW: 368,
  vbH: 138,
  origin: { x: 102, y: -22, r: 9, stroke: 5 },
  destination: { x: 166, y: -22, r: 10.5 },
};

export function Wordmark({
  height = 28,
  color = colors.ink,
  accent = colors.lime,
  hideDestination,
  route,
}: {
  height?: number;
  color?: string;
  accent?: string;
  /** Splash uses this to animate the destination dot itself. */
  hideDestination?: boolean;
  /** Draws the dotted path between origin and destination (large sizes only). */
  route?: boolean;
}) {
  const { vbX, vbY, vbW, vbH, origin: o, destination: d } = WORDMARK;
  return (
    <Svg width={(height * vbW) / vbH} height={height} viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} accessibilityLabel="NÜVA" accessibilityRole="image">
      <G fill={color}>
        <Path d={WORDMARK_PATHS.N} />
        <Path d={WORDMARK_PATHS.U} />
        <Path d={WORDMARK_PATHS.V} />
        <Path d={WORDMARK_PATHS.A} />
      </G>
      {route ? (
        <Path d={`M${o.x + 14} ${o.y} Q${(o.x + d.x) / 2} ${o.y - 18} ${d.x - 15} ${d.y}`} stroke={color} strokeOpacity={0.45} strokeWidth={3} strokeDasharray="1 7" strokeLinecap="round" fill="none" />
      ) : null}
      <Circle cx={o.x} cy={o.y} r={o.r} fill="none" stroke={color} strokeWidth={o.stroke} />
      {hideDestination ? null : <Circle cx={d.x} cy={d.y} r={d.r} fill={accent} />}
    </Svg>
  );
}

/**
 * App icon v2: the Ü alone, large, on Midnight. Hollow origin ring, solid lime
 * destination — the brand idea at 48 px.
 */
export function AppIcon({ size = 96, variant = 'midnight' }: { size?: number; variant?: 'midnight' | 'lime' | 'ivory' }) {
  const bg = variant === 'midnight' ? colors.midnight : variant === 'lime' ? colors.lime : colors.ivory;
  const fg = variant === 'midnight' ? colors.ivory : colors.midnight;
  const dot = variant === 'lime' ? colors.midnight : colors.lime;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Ícono de NÜVA" accessibilityRole="image">
      <Rect x={0} y={0} width={100} height={100} rx={23} fill={bg} />
      <G transform="translate(30 34) scale(0.5)">
        <Path d="M0 0H16V60A24 24 0 0 0 64 60V0H80V60A40 40 0 0 1 0 60Z" fill={fg} />
      </G>
      <Circle cx={34} cy={23} r={4.5} fill="none" stroke={fg} strokeWidth={2.5} />
      <Circle cx={66} cy={23} r={5.25} fill={dot} />
    </Svg>
  );
}

/** Origin → destination glyph used in route summaries. */
export function RouteGlyph({ height = 44, color = colors.ink, accent = colors.lime, dashed = colors.ivory400 }: { height?: number; color?: string; accent?: string; dashed?: string }) {
  return (
    <Svg width={12} height={height} viewBox={`0 0 12 ${height}`}>
      <Circle cx={6} cy={6} r={4} fill="none" stroke={color} strokeWidth={2.5} />
      <Path d={`M6 13V${height - 13}`} stroke={dashed} strokeWidth={2} strokeDasharray="2 4" strokeLinecap="round" />
      <Rect x={1} y={height - 11} width={10} height={10} rx={2} fill={accent} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

/** Abstract polygon used as a decorative backdrop on brand surfaces. */
export function BrandRings({ size = 420, color = colors.lime, opacity = 0.14 }: { size?: number; color?: string; opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" pointerEvents="none">
      {[96, 76, 56, 36].map((r, i) => (
        <Circle key={r} cx={100} cy={100} r={r} fill="none" stroke={color} strokeOpacity={opacity * (1 - i * 0.18)} strokeWidth={0.6} />
      ))}
      <Polygon points="100,4 104,100 100,196 96,100" fill={color} fillOpacity={opacity * 0.4} />
    </Svg>
  );
}
