import React from 'react';
import { ActivityIndicator, Platform, Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, shadow } from '../../theme/tokens';
import { Txt } from './Txt';

const APressable = Animated.createAnimatedComponent(Pressable);

export function haptic(kind: 'light' | 'medium' | 'success' | 'warning' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
}

/** Pressable that gently compresses on touch. Base for every tappable surface. */
export function Tap({
  children,
  style,
  scaleTo = 0.97,
  onPress,
  disabled,
  haptics = true,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; haptics?: boolean; children?: React.ReactNode }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      disabled={disabled}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      accessibilityState={{ disabled: !!disabled }}
      onPressIn={(e) => {
        s.value = withTiming(scaleTo, { duration: 90 });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, { damping: 14, stiffness: 260 });
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptics) haptic('light');
        onPress?.(e);
      }}
      style={[a, style, Platform.OS === 'web' && ({ cursor: disabled ? 'default' : 'pointer' } as object)]}
    >
      {children}
    </APressable>
  );
}

type Variant = 'primary' | 'dark' | 'light' | 'ghost' | 'outline' | 'outlineDark' | 'danger';
type Size = 'lg' | 'md' | 'sm';

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.lime, fg: colors.midnight },
  dark: { bg: colors.midnight, fg: colors.ivory },
  light: { bg: colors.white, fg: colors.ink },
  ghost: { bg: 'transparent', fg: colors.ink },
  outline: { bg: 'transparent', fg: colors.ink, border: colors.lineLightStrong },
  outlineDark: { bg: 'transparent', fg: colors.ivory, border: colors.lineDarkStrong },
  danger: { bg: colors.danger, fg: colors.white },
};

const SIZES: Record<Size, { h: number; px: number; text: 'title' | 'bodyStrong' | 'smallStrong'; icon: number }> = {
  lg: { h: 58, px: 24, text: 'title', icon: 20 },
  md: { h: 48, px: 18, text: 'bodyStrong', icon: 18 },
  sm: { h: 36, px: 14, text: 'smallStrong', icon: 16 },
};

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Right-aligned secondary content, e.g. a price inside a CTA. */
  trailing?: React.ReactNode;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  iconRight: IconRight,
  loading,
  disabled,
  full = true,
  style,
  trailing,
  accessibilityHint,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const inactive = disabled || loading;
  return (
    <Tap
      onPress={onPress}
      disabled={inactive}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={[
        {
          height: s.h,
          paddingHorizontal: s.px,
          borderRadius: radius.pill,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1.5 : 0,
          borderColor: v.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: trailing ? 'space-between' : 'center',
          alignSelf: full ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.38 : 1,
          gap: 10,
        },
        variant === 'primary' && !disabled && size === 'lg' ? shadow.glow : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {Icon ? <Icon size={s.icon} color={v.fg} strokeWidth={2.4} /> : null}
            <Txt v={s.text} color={v.fg}>
              {label}
            </Txt>
            {IconRight ? <IconRight size={s.icon} color={v.fg} strokeWidth={2.4} /> : null}
          </View>
          {trailing}
        </>
      )}
    </Tap>
  );
}

export function IconButton({
  icon: Icon,
  onPress,
  label,
  tone = 'light',
  size = 44,
  style,
  badge,
}: {
  icon: LucideIcon;
  onPress?: () => void;
  label: string;
  tone?: 'light' | 'dark' | 'lime' | 'glass' | 'clear' | 'clearDark';
  size?: number;
  style?: StyleProp<ViewStyle>;
  badge?: boolean;
}) {
  const bg = {
    light: colors.white,
    dark: colors.midnight,
    lime: colors.lime,
    glass: 'rgba(251,251,248,0.9)',
    clear: 'transparent',
    clearDark: 'transparent',
  }[tone];
  const fg = tone === 'dark' || tone === 'clearDark' ? colors.ivory : colors.ink;
  return (
    <Tap
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        (tone === 'light' || tone === 'glass') && shadow.soft,
        style,
      ]}
    >
      <Icon size={Math.round(size * 0.44)} color={fg} strokeWidth={2.2} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: size * 0.2,
            right: size * 0.22,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: colors.lime,
            borderWidth: 2,
            borderColor: bg === 'transparent' ? colors.midnight : bg,
          }}
        />
      ) : null}
    </Tap>
  );
}
