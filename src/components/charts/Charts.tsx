import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '../../theme/tokens';
import { Tap } from '../ui/Button';
import { Txt } from '../ui/Txt';

export interface BarDatum {
  label: string;
  value: number;
  highlight?: boolean;
  muted?: boolean;
}

function Bar({ h, max, height, i, color }: { h: number; max: number; height: number; i: number; color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(i * 45, withTiming(max ? h / max : 0, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [h, max, i, v]);
  const a = useAnimatedStyle(() => ({ height: Math.max(4, v.value * height) }));
  return <Animated.View style={[{ width: '100%', borderRadius: 8, backgroundColor: color }, a]} />;
}

/** Vertical bars with an optional selected bar and value callout. */
export function BarChart({
  data,
  height = 140,
  tone = 'dark',
  format,
  selected,
  onSelect,
}: {
  data: BarDatum[];
  height?: number;
  tone?: 'dark' | 'light';
  format?: (n: number) => string;
  selected?: number;
  onSelect?: (i: number) => void;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const dark = tone === 'dark';
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: height + 22, gap: 6 }}>
        {data.map((d, i) => {
          const on = selected === undefined ? d.highlight : selected === i;
          const color = on ? (dark ? colors.lime : colors.midnight) : d.muted ? (dark ? colors.midnight600 : colors.ivory200) : dark ? colors.midnight500 : colors.ivory400;
          return (
            <Tap
              key={`${d.label}-${i}`}
              haptics={false}
              scaleTo={0.94}
              onPress={onSelect ? () => onSelect(i) : undefined}
              disabled={!onSelect}
              accessibilityLabel={`${d.label}: ${format ? format(d.value) : d.value}`}
              style={{ flex: 1, height: height + 22, justifyContent: 'flex-end', alignItems: 'center' }}
            >
              {on && format ? (
                <Txt v="caption" tabular color={dark ? colors.ivory : colors.ink} style={{ marginBottom: 4 }} numberOfLines={1}>
                  {format(d.value)}
                </Txt>
              ) : null}
              <Bar h={d.value} max={max} height={height} i={i} color={color} />
            </Tap>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        {data.map((d, i) => (
          <Txt
            key={`${d.label}-l${i}`}
            v="caption"
            align="center"
            style={{ flex: 1 }}
            color={(selected === undefined ? d.highlight : selected === i) ? (dark ? colors.ivory : colors.ink) : dark ? colors.onDarkFaint : colors.inkMuted}
            numberOfLines={1}
          >
            {d.label}
          </Txt>
        ))}
      </View>
    </View>
  );
}

/** Smooth area chart with optional comparison series. */
export function AreaChart({
  values,
  compare,
  height = 180,
  tone = 'light',
  labels,
}: {
  values: number[];
  compare?: number[];
  height?: number;
  tone?: 'dark' | 'light';
  labels?: string[];
}) {
  const [w, setW] = useState(0);
  const dark = tone === 'dark';
  const all = [...values, ...(compare ?? [])];
  const max = Math.max(1, ...all) * 1.1;
  const min = 0;
  const pts = (arr: number[]) =>
    arr.map((v, i) => ({ x: arr.length === 1 ? 0 : (i / (arr.length - 1)) * w, y: height - ((v - min) / (max - min)) * height }));
  const smooth = (p: { x: number; y: number }[]) => {
    if (!p.length) return '';
    let d = `M${p[0].x} ${p[0].y}`;
    for (let i = 1; i < p.length; i++) {
      const c = (p[i - 1].x + p[i].x) / 2;
      d += ` C${c} ${p[i - 1].y} ${c} ${p[i].y} ${p[i].x} ${p[i].y}`;
    }
    return d;
  };
  const main = pts(values);
  const line = smooth(main);
  const area = main.length ? `${line} L${w} ${height} L0 ${height} Z` : '';
  const last = main[main.length - 1];
  const stroke = dark ? colors.lime : colors.midnight;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {w ? (
        <Svg width={w} height={height + 8}>
          <Defs>
            <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={dark ? colors.lime : colors.lime} stopOpacity={dark ? 0.28 : 0.55} />
              <Stop offset="1" stopColor={dark ? colors.lime : colors.lime} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0.25, 0.5, 0.75].map((k) => (
            <Line key={k} x1={0} x2={w} y1={height * k} y2={height * k} stroke={dark ? colors.lineDark : colors.lineLight} strokeDasharray="3 5" />
          ))}
          {compare ? <Path d={smooth(pts(compare))} stroke={dark ? colors.midnight400 : colors.ivory400} strokeWidth={2} fill="none" strokeDasharray="5 6" /> : null}
          <Path d={area} fill="url(#area)" />
          <Path d={line} stroke={stroke} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          {last ? <Circle cx={last.x} cy={last.y} r={5} fill={colors.lime} stroke={stroke} strokeWidth={2.5} /> : null}
        </Svg>
      ) : (
        <View style={{ height: height + 8 }} />
      )}
      {labels ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          {labels.map((l, i) => (
            <Txt key={`${l}-${i}`} v="caption" color={dark ? colors.onDarkFaint : colors.inkMuted}>
              {l}
            </Txt>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Thin progress ring, used for the driver request countdown. */
export function Ring({ size = 64, stroke = 5, progress, color = colors.lime, track = colors.midnight500, children }: { size?: number; stroke?: number; progress: number; color?: string; track?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))} strokeLinecap="round" />
      </Svg>
      {children}
    </View>
  );
}

/** Small inline sparkline. */
export function Sparkline({ values, width = 90, height = 28, color = colors.lime }: { values: number[]; width?: number; height?: number; color?: string }) {
  const max = Math.max(1, ...values);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, values.length - 1)) * width} ${height - (v / max) * (height - 4) - 2}`).join(' ');
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
