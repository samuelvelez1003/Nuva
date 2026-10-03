import React from 'react';
import Svg, { Polygon, Rect } from 'react-native-svg';
import type { CountryCode } from '../../lib/countries';

// Drawn flags: emoji flags don't render on Windows browsers (they show "CO" / "CW").

/** Five-pointed star centred on (cx, cy) with outer radius r. */
function starPoints(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.382;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

export function Flag({ code, width = 48, radius = 6 }: { code: CountryCode; width?: number; radius?: number }) {
  const h = (width * 2) / 3;
  if (code === 'CO') {
    // Colombia: yellow (half), blue, red.
    return (
      <Svg width={width} height={h} viewBox="0 0 90 60" accessibilityLabel="Bandera de Colombia">
        <Rect x={0} y={0} width={90} height={60} rx={radius} fill="#CE1126" />
        <Rect x={0} y={0} width={90} height={45} rx={radius} fill="#003893" />
        <Rect x={0} y={0} width={90} height={30} rx={radius} fill="#FCD116" />
        <Rect x={0} y={20} width={90} height={10} fill="#FCD116" />
        <Rect x={0} y={30} width={90} height={15} fill="#003893" />
      </Svg>
    );
  }
  // Curaçao: blue field, yellow stripe below the middle, two white stars at the hoist.
  return (
    <Svg width={width} height={h} viewBox="0 0 90 60" accessibilityLabel="Bandera de Curazao">
      <Rect x={0} y={0} width={90} height={60} rx={radius} fill="#002B7F" />
      <Rect x={0} y={37.5} width={90} height={7.5} fill="#F9E814" />
      <Polygon points={starPoints(10, 10, 5)} fill="#FFFFFF" />
      <Polygon points={starPoints(20, 20, 7)} fill="#FFFFFF" />
    </Svg>
  );
}
