import React, { useId } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { aurora, colors, fonts } from '../../theme/tokens';
import { Txt } from '../ui/Txt';

/**
 * NÜVA brand, "28 · Aurora": the word NÜVA in Sora Bold with open tracking (as in the
 * mockup's nav pill) and an "aurora tile" mark: a rounded square on the cool ground
 * with soft mint / violet / cyan light and an ink "N" (app icon, splash, favicon).
 */

/** Rounded-square aurora light, drawn with SVG radial gradients (same on web and native). */
function AuroraTileBg({ size, radius }: { size: number; radius: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const g = (n: string) => `${n}${uid}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <ClipPath id={g('clip')}>
          <Rect x={0} y={0} width={100} height={100} rx={(radius / size) * 100} />
        </ClipPath>
        {(
          [
            ['m', aurora.mint, 0.95],
            ['v', aurora.violet, 0.85],
            ['c', aurora.cyan, 0.8],
          ] as const
        ).map(([k, c, o]) => (
          <RadialGradient key={k} id={g(k)} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={c} stopOpacity={o} />
            <Stop offset="0.5" stopColor={c} stopOpacity={o * 0.7} />
            <Stop offset="1" stopColor={c} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      <Rect x={0} y={0} width={100} height={100} rx={(radius / size) * 100} fill={colors.ivory100} />
      <Ellipse cx={18} cy={14} rx={62} ry={54} fill={`url(#${g('m')})`} clipPath={`url(#${g('clip')})`} />
      <Ellipse cx={96} cy={52} rx={52} ry={50} fill={`url(#${g('v')})`} clipPath={`url(#${g('clip')})`} />
      <Ellipse cx={42} cy={104} rx={60} ry={40} fill={`url(#${g('c')})`} clipPath={`url(#${g('clip')})`} />
    </Svg>
  );
}

/** Rounded-square "N" mark. Without `bg` it is the aurora tile with an ink "N". */
export function LogoMark({
  size = 34,
  bg,
  fg,
  dot,
  dotColor = colors.coral,
  style,
}: {
  size?: number;
  /** Solid tile colour; omit for the aurora tile. */
  bg?: string;
  fg?: string;
  /** Small violet destination square in the top-right corner. */
  dot?: boolean;
  dotColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const r = Math.round(size * 0.3);
  return (
    <View
      style={[{ width: size, height: size, borderRadius: r, backgroundColor: bg ?? colors.ivory100, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}
      accessible={false}
    >
      {bg ? null : <AuroraTileBg size={size} radius={r} />}
      <Txt
        style={{ fontFamily: fonts.bold, fontSize: Math.round(size * 0.5), lineHeight: Math.round(size * 0.62), color: fg ?? colors.ink, includeFontPadding: false, letterSpacing: 0 }}
        accessible={false}
      >
        N
      </Txt>
      {dot ? (
        <View
          style={{
            position: 'absolute',
            top: size * 0.17,
            right: size * 0.2,
            width: Math.max(4, size * 0.12),
            height: Math.max(4, size * 0.12),
            borderRadius: Math.max(1, size * 0.03),
            backgroundColor: dotColor,
          }}
        />
      ) : null}
    </View>
  );
}

const LIGHT = new Set<string>([colors.ivory, colors.ivory50, colors.ivory100, colors.white, colors.onDark]);

/**
 * Logo: the word NÜVA (Sora Bold, tracked out like the mockup's nav). `height` is the
 * visual height of the line; `mark` adds the aurora tile in front (solid ink tile on
 * dark surfaces, so it never glows on ink).
 */
export function Wordmark({
  height = 28,
  color = colors.ink,
  accent = colors.coral,
  dot,
  mark = false,
}: {
  height?: number;
  color?: string;
  /** Colour of the destination square, when shown. */
  accent?: string;
  dot?: boolean;
  /** Show the "N" tile in front of the word. */
  mark?: boolean;
}) {
  const onDark = LIGHT.has(color);
  const fontSize = Math.round(height * 0.62);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Math.round(height * 0.3) }} accessible accessibilityRole="image" accessibilityLabel="NÜVA">
      {mark ? <LogoMark size={height} bg={onDark ? colors.midnight600 : undefined} fg={onDark ? colors.onDark : undefined} dot={dot} dotColor={accent} /> : null}
      <Txt
        style={{ fontFamily: fonts.bold, fontSize, lineHeight: Math.round(height * 0.9), letterSpacing: Math.max(1, fontSize * 0.1), color }}
        accessible={false}
      >
        NÜVA
      </Txt>
    </View>
  );
}

/**
 * App icon: passenger = the aurora tile with an ink "N"; driver = teal with a white "N"
 * and CONDUCE; ivory = a plain white tile (light chrome).
 */
export function AppIcon({ size = 96, variant = 'midnight' }: { size?: number; variant?: 'midnight' | 'lime' | 'ivory' }) {
  const r = Math.round(size * 0.23);
  const bg = variant === 'lime' ? colors.lime : variant === 'ivory' ? colors.white : undefined;
  const fg = variant === 'lime' ? colors.white : colors.ink;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Ícono de NÜVA"
      style={{ width: size, height: size, borderRadius: r, backgroundColor: bg ?? colors.ivory100, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      {bg ? null : <AuroraTileBg size={size} radius={r} />}
      <Txt style={{ fontFamily: fonts.bold, fontSize: Math.round(size * 0.54), lineHeight: Math.round(size * 0.68), color: fg, includeFontPadding: false }} accessible={false}>
        N
      </Txt>
      {variant === 'lime' && size >= 64 ? (
        <Txt
          style={{ position: 'absolute', bottom: size * 0.12, fontFamily: fonts.bold, fontSize: Math.round(size * 0.085), lineHeight: Math.round(size * 0.11), letterSpacing: size * 0.015, color: fg }}
          accessible={false}
        >
          CONDUCE
        </Txt>
      ) : null}
    </View>
  );
}

/** Origin → destination glyph used in route summaries: ink ring, line, violet square. */
export function RouteGlyph({ height = 44, color = colors.ink, accent = colors.coral, dashed = colors.ivory400 }: { height?: number; color?: string; accent?: string; dashed?: string }) {
  return (
    <Svg width={12} height={height} viewBox={`0 0 12 ${height}`}>
      <Circle cx={6} cy={6} r={4.5} fill="none" stroke={color} strokeWidth={3} />
      <Path d={`M6 14V${height - 14}`} stroke={dashed} strokeWidth={2} strokeLinecap="round" />
      <Rect x={0} y={height - 12} width={12} height={12} rx={4} fill={accent} />
    </Svg>
  );
}

/** Abstract rings used as a decorative backdrop on brand surfaces. */
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
