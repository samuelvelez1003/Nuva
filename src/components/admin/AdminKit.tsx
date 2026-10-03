import React, { useRef, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, StyleProp, useWindowDimensions, View, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react-native';
import { colors, radius, shadow, space } from '../../theme/tokens';
import { Row } from '../ui/primitives';
import { Txt } from '../ui/Txt';

export const useWide = (bp = 1000) => useWindowDimensions().width >= bp;

/** Page header for admin sections. */
export function PageHead({ kicker, title, subtitle, right }: { kicker?: string; title: string; subtitle?: string; right?: React.ReactNode }) {
  const wide = useWide(760);
  return (
    <View style={{ flexDirection: wide ? 'row' : 'column', justifyContent: 'space-between', alignItems: wide ? 'flex-end' : 'flex-start', gap: space[4], marginBottom: space[6] }}>
      <View style={{ flexShrink: 1 }}>
        {kicker ? (
          <Txt v="overline" color={colors.inkMuted}>
            {kicker}
          </Txt>
        ) : null}
        <Txt v={wide ? 'display' : 'h1'} style={{ marginTop: 6 }} accessibilityRole="header">
          {title}
        </Txt>
        {subtitle ? (
          <Txt v="body" color={colors.inkMuted} style={{ marginTop: 6, maxWidth: 640 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ? <Row style={{ gap: 10, flexWrap: 'wrap' }}>{right}</Row> : null}
    </View>
  );
}

/** White panel with optional title row. */
export function Panel({
  title,
  subtitle,
  right,
  children,
  style,
  padded = true,
  tone = 'light',
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';
  return (
    <View
      style={[
        {
          backgroundColor: dark ? colors.midnight : colors.white,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: dark ? colors.midnight : colors.lineLight,
          padding: padded ? space[5] : 0,
        },
        style,
      ]}
    >
      {title ? (
        <Row style={{ justifyContent: 'space-between', marginBottom: space[4], paddingHorizontal: padded ? 0 : space[5], paddingTop: padded ? 0 : space[5], gap: 12 }}>
          <View style={{ flexShrink: 1 }}>
            <Txt v="h3" color={dark ? colors.ivory : colors.ink}>
              {title}
            </Txt>
            {subtitle ? (
              <Txt v="caption" color={dark ? colors.onDarkMuted : colors.inkMuted}>
                {subtitle}
              </Txt>
            ) : null}
          </View>
          {right}
        </Row>
      ) : null}
      {children}
    </View>
  );
}

export function Kpi({
  label,
  value,
  delta,
  icon: Icon,
  hint,
  accent,
  invert,
  style,
}: {
  label: string;
  value: string;
  delta?: number;
  icon?: LucideIcon;
  hint?: string;
  accent?: boolean;
  /** Lower is better (e.g. wait times): a drop is shown as good news. */
  invert?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const rising = (delta ?? 0) >= 0;
  const up = invert ? !rising : rising;
  return (
    <View
      style={[
        {
          flexGrow: 1,
          flexBasis: 220,
          backgroundColor: accent ? colors.midnight : colors.white,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: accent ? colors.midnight : colors.lineLight,
          padding: space[5],
          minHeight: 132,
          justifyContent: 'space-between',
        },
        style,
      ]}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="smallStrong" color={accent ? colors.onDarkMuted : colors.inkMuted}>
          {label}
        </Txt>
        {Icon ? <Icon size={16} color={accent ? colors.lime : colors.inkMuted} /> : null}
      </Row>
      <View style={{ marginTop: space[3] }}>
        <Txt v="h1" tabular color={accent ? colors.ivory : colors.ink} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Txt>
        {/* Always present (even empty) so every card's number sits on the same line. */}
        <Row style={{ gap: 8, marginTop: 4, minHeight: 20 }}>
          {delta !== undefined ? (
            <Row style={{ gap: 2, paddingHorizontal: 6, height: 20, borderRadius: 6, backgroundColor: accent ? colors.midnight600 : up ? colors.limeTint : colors.dangerSoft }}>
              {rising ? (
                <ArrowUpRight size={12} color={accent ? (up ? colors.lime : colors.danger) : up ? colors.limeInk : colors.dangerInk} />
              ) : (
                <ArrowDownRight size={12} color={accent ? (up ? colors.lime : colors.danger) : up ? colors.limeInk : colors.dangerInk} />
              )}
              <Txt v="caption" color={accent ? (up ? colors.lime : colors.danger) : up ? colors.limeInk : colors.dangerInk} tabular>
                {Math.abs(delta * 100).toFixed(1).replace('.', ',')} %
              </Txt>
            </Row>
          ) : null}
          {hint ? (
            <Txt v="caption" color={accent ? colors.onDarkFaint : colors.inkMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
              {hint}
            </Txt>
          ) : null}
        </Row>
      </View>
    </View>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  flex?: number;
  width?: number;
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
}

/**
 * Data table that collapses into stacked cards on narrow screens so the
 * admin stays usable on a phone.
 */
export function DataTable<T>({ rows, columns, keyOf, empty, onRowPress, selectedKey }: { rows: T[]; columns: Column<T>[]; keyOf: (r: T) => string; empty?: React.ReactNode; onRowPress?: (r: T) => void; selectedKey?: string }) {
  // Decide by the table's own width, not the window: side panels shrink it.
  const [w, setW] = useState(0);
  // Fixed-width columns need their width; flexible ones at least 160 px to stay readable.
  const minTable = columns.reduce((s, c) => s + (c.width ?? 160), 0) + 40;
  const wide = w >= minTable;
  if (!rows.length) return <>{empty}</>;
  if (!w) return <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ minHeight: 40 }} />;
  if (!wide) {
    return (
      <View style={{ gap: 10, padding: space[3] }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {rows.map((r) => (
          <View
            key={keyOf(r)}
            onStartShouldSetResponder={() => !!onRowPress}
            onResponderRelease={() => onRowPress?.(r)}
            style={{ backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: selectedKey === keyOf(r) ? colors.midnight : colors.lineLight, padding: space[4], gap: 8 }}
          >
            <View>{columns[0].render(r)}</View>
            {columns.slice(1).map((c) => (
              <Row key={c.key} style={{ justifyContent: 'space-between', gap: 12 }}>
                <Txt v="caption" color={colors.inkMuted}>
                  {c.label}
                </Txt>
                <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>{c.render(r)}</View>
              </Row>
            ))}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <View style={{ flex: 1 }}>
        <Row style={{ paddingHorizontal: space[5], paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.lineLight }}>
          {columns.map((c) => (
            <View key={c.key} style={{ flex: c.width ? undefined : c.flex ?? 1, width: c.width, minWidth: 0, alignItems: c.align === 'right' ? 'flex-end' : 'flex-start', paddingRight: 10 }}>
              <Txt v="overline" color={colors.inkMuted}>
                {c.label}
              </Txt>
            </View>
          ))}
        </Row>
        {rows.map((r, i) => {
          const k = keyOf(r);
          const sel = selectedKey === k;
          return (
            <View
              key={k}
              onStartShouldSetResponder={() => !!onRowPress}
              onResponderRelease={() => onRowPress?.(r)}
              style={[
                { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[5], paddingVertical: 12, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.lineLight, backgroundColor: sel ? colors.ivory100 : 'transparent' },
                onRowPress ? ({ cursor: 'pointer' } as object) : null,
              ]}
            >
              {columns.map((c) => (
                <View key={c.key} style={{ flex: c.width ? undefined : c.flex ?? 1, width: c.width, minWidth: 0, overflow: 'hidden', alignItems: c.align === 'right' ? 'flex-end' : 'flex-start', paddingRight: 10 }}>
                  {c.render(r)}
                </View>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Minimal accessible slider built on the responder system (works on web and native). */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
}) {
  const [w, setW] = useState(0);
  const ref = useRef<View>(null);
  const left = useRef(0);
  const k = (value - min) / (max - min || 1);
  const set = (x: number) => {
    const raw = min + Math.max(0, Math.min(1, x / (w || 1))) * (max - min);
    const v = Math.round(raw / step) * step;
    onChange(Number(v.toFixed(4)));
  };
  const onLayout = (e: LayoutChangeEvent) => {
    setW(e.nativeEvent.layout.width);
    ref.current?.measure((_x, _y, _w, _h, pageX) => (left.current = pageX));
  };
  const handle = (e: GestureResponderEvent) => set(e.nativeEvent.pageX - left.current);
  return (
    <View
      ref={ref}
      onLayout={onLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: format ? format(value) : String(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.max(min, Math.min(max, value + (e.nativeEvent.actionName === 'increment' ? step : -step))))}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        ref.current?.measure((_x, _y, _w, _h, pageX) => (left.current = pageX));
        handle(e);
      }}
      onResponderMove={handle}
      style={[{ height: 32, justifyContent: 'center' }, { cursor: 'pointer' } as object]}
    >
      <View pointerEvents="none" style={{ height: 6, borderRadius: 3, backgroundColor: colors.ivory200 }}>
        <View style={{ width: `${k * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.midnight }} />
      </View>
      <View pointerEvents="none" style={[{ position: 'absolute', left: Math.max(0, k * w - 12), width: 24, height: 24, borderRadius: 12, backgroundColor: colors.lime, borderWidth: 3, borderColor: colors.midnight }, shadow.soft]} />
    </View>
  );
}
