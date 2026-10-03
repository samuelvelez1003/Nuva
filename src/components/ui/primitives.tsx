import React, { useEffect } from 'react';
import { Image, StyleProp, TextInput, TextInputProps, View, ViewProps, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ChevronRight, LucideIcon, Star } from 'lucide-react-native';
import { colors, fonts, radius, shadow, space } from '../../theme/tokens';
import { Tap } from './Button';
import { Txt } from './Txt';

type Tone = 'light' | 'dark';

export function Row({ style, ...p }: ViewProps & { style?: StyleProp<ViewStyle> }) {
  return <View {...p} style={[{ flexDirection: 'row', alignItems: 'center' }, style]} />;
}

export function Spacer({ h = 0, w = 0, flex }: { h?: number; w?: number; flex?: boolean }) {
  return <View style={flex ? { flex: 1 } : { height: h, width: w }} />;
}

export function Card({
  children,
  tone = 'light',
  style,
  padded = true,
  elevated,
}: {
  children: React.ReactNode;
  tone?: Tone | 'ivory' | 'lime' | 'raised';
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
}) {
  const bg = {
    light: colors.white,
    ivory: colors.ivory100,
    dark: colors.midnight700,
    raised: colors.midnight600,
    lime: colors.lime,
  }[tone];
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.lg,
          padding: padded ? space[5] : 0,
          borderWidth: tone === 'dark' || tone === 'raised' ? 1 : tone === 'light' ? 1 : 0,
          borderColor: tone === 'dark' || tone === 'raised' ? colors.lineDark : colors.lineLight,
        },
        elevated && shadow.soft,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Divider({ tone = 'light', inset = 0, style }: { tone?: Tone; inset?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { height: 1, marginLeft: inset, backgroundColor: tone === 'dark' ? colors.lineDark : colors.lineLight },
        style,
      ]}
    />
  );
}

export function Chip({
  label,
  icon: Icon,
  active,
  onPress,
  tone = 'light',
  style,
}: {
  label: string;
  icon?: LucideIcon;
  active?: boolean;
  onPress?: () => void;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const dark = tone === 'dark';
  const bg = active ? (dark ? colors.lime : colors.midnight) : dark ? colors.midnight600 : colors.white;
  const fg = active ? (dark ? colors.midnight : colors.ivory) : dark ? colors.onDark : colors.ink;
  return (
    <Tap
      onPress={onPress}
      accessibilityState={{ selected: !!active }}
      style={[
        {
          height: 38,
          paddingHorizontal: 14,
          borderRadius: radius.pill,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          borderWidth: active ? 0 : 1,
          borderColor: dark ? colors.lineDark : colors.lineLight,
        },
        style,
      ]}
    >
      {Icon ? <Icon size={15} color={fg} strokeWidth={2.4} /> : null}
      <Txt v="smallStrong" color={fg}>
        {label}
      </Txt>
    </Tap>
  );
}

type BadgeTone = 'lime' | 'dark' | 'neutral' | 'danger' | 'warning' | 'info' | 'success' | 'ghostDark';

const BADGE: Record<BadgeTone, { bg: string; fg: string }> = {
  lime: { bg: colors.lime, fg: colors.midnight },
  dark: { bg: colors.midnight, fg: colors.ivory },
  neutral: { bg: colors.ivory200, fg: colors.inkSoft },
  danger: { bg: colors.dangerSoft, fg: colors.dangerInk },
  warning: { bg: colors.warningSoft, fg: colors.warningInk },
  info: { bg: colors.infoSoft, fg: '#1F4E8C' },
  success: { bg: colors.limeTint, fg: colors.limeInk },
  ghostDark: { bg: colors.midnight600, fg: colors.onDark },
};

export function Badge({ label, tone = 'neutral', dot, style }: { label: string; tone?: BadgeTone; dot?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = BADGE[tone];
  return (
    <Row
      style={[
        { alignSelf: 'flex-start', backgroundColor: t.bg, paddingHorizontal: 9, height: 24, borderRadius: radius.pill, gap: 6 },
        style,
      ]}
    >
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.fg }} /> : null}
      <Txt v="caption" color={t.fg}>
        {label}
      </Txt>
    </Row>
  );
}

export function Avatar({
  initials,
  size = 44,
  bg = colors.ivory300,
  fg = colors.ink,
  ring,
  image,
}: {
  initials: string;
  size?: number;
  bg?: string;
  fg?: string;
  ring?: string;
  /** Profile photo; falls back to the initials. */
  image?: string | null;
}) {
  const fontSize = size * 0.36;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 2.5 : 0,
        borderColor: ring,
        overflow: 'hidden',
      }}
      accessible={false}
    >
      {image ? (
        <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        // lineHeight follows the font size: the variant's default line height clipped big initials.
        <Txt style={{ fontFamily: fonts.extrabold, fontSize, lineHeight: Math.round(fontSize * 1.25), letterSpacing: -0.5, includeFontPadding: false }} color={fg}>
          {initials}
        </Txt>
      )}
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
  tone = 'light',
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Row style={[{ justifyContent: 'space-between', marginBottom: space[3] }, style]}>
      <Txt v="overline" color={tone === 'dark' ? colors.onDarkMuted : colors.inkMuted}>
        {title}
      </Txt>
      {action ? (
        <Tap onPress={onAction} hitSlop={8}>
          <Txt v="smallStrong" color={tone === 'dark' ? colors.lime : colors.ink} style={{ textDecorationLine: tone === 'dark' ? 'none' : 'underline' }}>
            {action}
          </Txt>
        </Tap>
      ) : null}
    </Row>
  );
}

export function ListRow({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  right,
  onPress,
  tone = 'light',
  chevron = true,
  style,
}: {
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  tone?: Tone;
  chevron?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const dark = tone === 'dark';
  const content = (
    <Row style={[{ gap: 14, paddingVertical: 13, minHeight: 56 }, style]}>
      {Icon ? (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: iconBg ?? (dark ? colors.midnight600 : colors.ivory200),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={19} color={iconColor ?? (dark ? colors.onDark : colors.ink)} strokeWidth={2.1} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Txt v="bodyStrong" color={dark ? colors.onDark : colors.ink} numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt v="small" color={dark ? colors.onDarkMuted : colors.inkMuted} numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
      {onPress && chevron ? <ChevronRight size={18} color={dark ? colors.onDarkFaint : colors.stone} /> : null}
    </Row>
  );
  return onPress ? (
    <Tap onPress={onPress} scaleTo={0.985} accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}>
      {content}
    </Tap>
  ) : (
    content
  );
}

export function KeyValue({
  label,
  value,
  strong,
  tone = 'light',
  valueColor,
  hint,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: Tone;
  valueColor?: string;
  hint?: string;
}) {
  const dark = tone === 'dark';
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 7, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Txt v={strong ? 'bodyStrong' : 'body'} color={dark ? (strong ? colors.onDark : colors.onDarkMuted) : strong ? colors.ink : colors.inkSoft}>
          {label}
        </Txt>
        {hint ? (
          <Txt v="caption" color={dark ? colors.onDarkFaint : colors.inkMuted}>
            {hint}
          </Txt>
        ) : null}
      </View>
      <Txt v={strong ? 'h3' : 'bodyStrong'} tabular color={valueColor ?? (dark ? colors.onDark : colors.ink)}>
        {value}
      </Txt>
    </Row>
  );
}

export function Stars({ value, size = 14, color = colors.ink, empty = colors.ivory400 }: { value: number; size?: number; color?: string; empty?: string }) {
  return (
    <Row style={{ gap: 2 }} accessibilityLabel={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} color={i <= Math.round(value) ? color : empty} fill={i <= Math.round(value) ? color : empty} />
      ))}
    </Row>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone = 'light',
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const dark = tone === 'dark';
  return (
    <Row
      accessibilityRole="tablist"
      style={[
        { backgroundColor: dark ? colors.midnight700 : colors.ivory200, borderRadius: radius.pill, padding: 4, gap: 4 },
        style,
      ]}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Tap
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              height: 38,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? (dark ? colors.lime : colors.white) : 'transparent',
              ...(active && !dark ? (shadow.soft as object) : {}),
            }}
          >
            <Txt v="smallStrong" color={active ? colors.ink : dark ? colors.onDarkMuted : colors.inkMuted}>
              {o.label}
            </Txt>
          </Tap>
        );
      })}
    </Row>
  );
}

export function ProgressBar({ value, tone = 'light', height = 6, color }: { value: number; tone?: Tone; height?: number; color?: string }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(1, value)), { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [value, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View
      style={{ height, borderRadius: height, backgroundColor: tone === 'dark' ? colors.midnight500 : colors.ivory200, overflow: 'hidden' }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: color ?? (tone === 'dark' ? colors.lime : colors.midnight) }, a]} />
    </View>
  );
}

export function Field({
  label,
  error,
  prefix,
  suffix,
  tone = 'light',
  style,
  ...input
}: TextInputProps & {
  label?: string;
  error?: string;
  prefix?: string;
  suffix?: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const [focus, setFocus] = React.useState(false);
  const dark = tone === 'dark';
  return (
    <View style={style}>
      {label ? (
        <Txt v="caption" color={dark ? colors.onDarkMuted : colors.inkMuted} style={{ marginBottom: 6 }}>
          {label}
        </Txt>
      ) : null}
      <Row
        style={{
          height: 52,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          backgroundColor: dark ? colors.midnight700 : colors.white,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : focus ? (dark ? colors.lime : colors.midnight) : dark ? colors.lineDark : colors.lineLightStrong,
          gap: 6,
        }}
      >
        {prefix ? (
          <Txt v="bodyStrong" color={dark ? colors.onDarkMuted : colors.inkMuted}>
            {prefix}
          </Txt>
        ) : null}
        <TextInput
          {...input}
          accessibilityLabel={input.accessibilityLabel ?? label}
          onFocus={(e) => {
            setFocus(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            input.onBlur?.(e);
          }}
          placeholderTextColor={dark ? colors.onDarkFaint : colors.stone}
          style={[
            {
              flex: 1,
              minWidth: 0,
              width: 10,
              height: '100%',
              fontFamily: fonts.bold,
              fontSize: 16,
              color: dark ? colors.onDark : colors.ink,
              fontVariant: ['tabular-nums'],
            },
            { outlineStyle: 'none' } as object,
          ]}
        />
        {suffix ? (
          <Txt v="smallStrong" color={dark ? colors.onDarkMuted : colors.inkMuted}>
            {suffix}
          </Txt>
        ) : null}
      </Row>
      {error ? (
        <Txt v="caption" color={colors.dangerInk} style={{ marginTop: 5 }} accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

/** Shimmering placeholder used for loading states. */
export function Skeleton({ w, h, r = 10, tone = 'light', style }: { w: number | `${number}%`; h: number; r?: number; tone?: Tone; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(1, { duration: 650 }), withTiming(0.5, { duration: 650 })), -1);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: tone === 'dark' ? colors.midnight600 : colors.ivory300 }, a, style]} />;
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  tone = 'light',
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
  tone?: Tone;
}) {
  const dark = tone === 'dark';
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 10 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 26,
          backgroundColor: dark ? colors.midnight600 : colors.ivory200,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
        }}
      >
        <Icon size={30} color={dark ? colors.lime : colors.ink} strokeWidth={1.8} />
      </View>
      <Txt v="h3" align="center" color={dark ? colors.onDark : colors.ink}>
        {title}
      </Txt>
      <Txt v="body" align="center" color={dark ? colors.onDarkMuted : colors.inkMuted}>
        {body}
      </Txt>
      {action ? <View style={{ marginTop: 10, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

/** Small pulsing dot used for "live" indicators. */
export function LiveDot({ color = colors.lime, size = 8 }: { color?: string; size?: number }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withTiming(2.6, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false);
  }, [s]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: (2.6 - s.value) / 1.6 }));
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size, backgroundColor: color }, ring]} />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}
