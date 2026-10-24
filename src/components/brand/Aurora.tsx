import React, { useId } from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { aurora } from '../../theme/tokens';

/**
 * Aurora backdrop ("28 · Aurora"): soft mint / violet / cyan blobs behind white cards.
 * Fills its parent (absolute, behind the content, never touchable); the parent should
 * clip it (`overflow: 'hidden'`).
 *   web    → absolutely positioned soft circles (CSS radial gradients that fade out like
 *            a blur, no `filter`) drifting slowly with a CSS animation (paused for
 *            `prefers-reduced-motion`).
 *   native → the same blobs as static SVG radial gradients: no blur filter, no
 *            animation, no extra dependency — cheap on any phone.
 * Used on the landing hero, the SEO heroes, auth/onboarding and the passenger home
 * header — not behind every screen.
 */

type Edge = { left?: number; right?: number; top?: number; bottom?: number };
type Blob = Edge & { w: number; h: number; color: string; blur: number; opacity: number; drift?: 'normal' | 'reverse'; duration?: number };

/** Blob layouts taken from the mockup: `web` = the website hero, `app` = a phone screen. */
const LAYOUTS: Record<'web' | 'app', Blob[]> = {
  web: [
    { w: 520, h: 420, left: -120, top: -140, color: aurora.mint, blur: 80, opacity: 0.75, drift: 'normal', duration: 14 },
    { w: 460, h: 380, right: -80, top: 120, color: aurora.violet, blur: 90, opacity: 0.6, drift: 'reverse', duration: 18 },
    { w: 500, h: 300, left: 220, bottom: -160, color: aurora.cyan, blur: 90, opacity: 0.55 },
  ],
  app: [
    { w: 320, h: 280, left: -100, top: -80, color: aurora.mint, blur: 60, opacity: 0.8, drift: 'normal', duration: 16 },
    { w: 260, h: 260, right: -110, top: 120, color: aurora.violet, blur: 60, opacity: 0.65, drift: 'reverse', duration: 20 },
  ],
};

const KEYFRAMES =
  '@keyframes nuvaDrift{0%{transform:translate(0,0) scale(1)}50%{transform:translate(30px,-20px) scale(1.08)}100%{transform:translate(0,0) scale(1)}}' +
  '@media (prefers-reduced-motion: reduce){.nuva-aurora-blob{animation:none!important}}';

/** '#7BE0C4' + alpha → 'rgba(123,224,196,a)'. */
function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}

function scaled(b: Blob, k: number): Blob {
  const s = (v?: number) => (v === undefined ? undefined : Math.round(v * k));
  return { ...b, w: s(b.w)!, h: s(b.h)!, left: s(b.left), right: s(b.right), top: s(b.top), bottom: s(b.bottom), blur: Math.round(b.blur * k) };
}

export function Aurora({
  layout = 'app',
  scale = 1,
  animated = true,
  intensity = 1,
  style,
}: {
  layout?: 'web' | 'app';
  /** Multiplies blob sizes and offsets (smaller headers, wider heroes). */
  scale?: number;
  /** Web only: slow drift. */
  animated?: boolean;
  /** Multiplies every blob's opacity (e.g. 0.7 behind dense content). */
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const blobs = LAYOUTS[layout].map((b) => scaled(b, scale));
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  if (Platform.OS === 'web') {
    return (
      <View pointerEvents="none" aria-hidden style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' }, style]}>
        {React.createElement('style', { dangerouslySetInnerHTML: { __html: KEYFRAMES } })}
        {blobs.map((b, i) => {
          // A blurred disc drawn as a radial gradient: solid in the middle, then an S-curve
          // fade across (r ± 1.5·blur), like `filter: blur()` but cheaper, and it still
          // renders inside rounded clipping containers (the staged phone), where Chrome
          // dropped blurred children.
          const m = Math.round(b.blur * 1.5);
          const r = Math.min(b.w, b.h) / 2;
          const R = r + m;
          const stops = Array.from({ length: 7 }, (_, k) => {
            const t = k / 6;
            const a = 1 - t * t * (3 - 2 * t);
            const at = Math.max(0, ((r - m + t * 2 * m) / R) * 100);
            return `${rgba(b.color, a)} ${at.toFixed(1)}%`;
          });
          const off = (v?: number) => (v === undefined ? undefined : v - m);
          return React.createElement('div', {
            key: i,
            className: 'nuva-aurora-blob',
            style: {
              position: 'absolute',
              width: b.w + m * 2,
              height: b.h + m * 2,
              left: off(b.left),
              right: off(b.right),
              top: off(b.top),
              bottom: off(b.bottom),
              background: `radial-gradient(closest-side, ${b.color} 0%, ${stops.join(', ')})`,
              opacity: Math.min(1, b.opacity * intensity),
              animation: animated && b.drift ? `nuvaDrift ${b.duration ?? 16}s ease-in-out infinite ${b.drift}` : undefined,
            },
          });
        })}
      </View>
    );
  }

  // Native: each blob is a radial gradient that fades to transparent, drawn in a box
  // grown by the blur radius on every side (that margin is where the soft edge lives).
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' }, style]}>
      {blobs.map((b, i) => {
        const m = b.blur;
        const W = b.w + m * 2;
        const H = b.h + m * 2;
        const id = `aur${uid}${i}`;
        const o = Math.min(1, b.opacity * intensity);
        return (
          <Svg
            key={i}
            width={W}
            height={H}
            style={{
              position: 'absolute',
              left: b.left !== undefined ? b.left - m : undefined,
              right: b.right !== undefined ? b.right - m : undefined,
              top: b.top !== undefined ? b.top - m : undefined,
              bottom: b.bottom !== undefined ? b.bottom - m : undefined,
            }}
          >
            <Defs>
              <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
                <Stop offset="0" stopColor={b.color} stopOpacity={o} />
                <Stop offset="0.45" stopColor={b.color} stopOpacity={o * 0.75} />
                <Stop offset="1" stopColor={b.color} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={W / 2} cy={H / 2} rx={W / 2} ry={H / 2} fill={`url(#${id})`} />
          </Svg>
        );
      })}
    </View>
  );
}
