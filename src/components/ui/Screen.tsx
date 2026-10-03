import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, ScrollViewProps, StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { ArrowLeft, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react-native';
import { useT } from '../../i18n';
import { colors, radius, shadow, space } from '../../theme/tokens';
import { IconButton } from './Button';
import { Row } from './primitives';
import { Txt } from './Txt';

// ─── Status bar tone (shared by native status bar and the web device frame) ─

type StatusTone = 'dark' | 'light';
const StatusCtx = createContext<{ tone: StatusTone; setTone: (t: StatusTone) => void }>({
  tone: 'dark',
  setTone: () => {},
});

export function StatusToneProvider({ children, initial = 'dark' }: { children: React.ReactNode; initial?: StatusTone }) {
  const [tone, setTone] = useState<StatusTone>(initial);
  return <StatusCtx.Provider value={{ tone, setTone }}>{children}</StatusCtx.Provider>;
}

export const useStatusToneValue = () => useContext(StatusCtx).tone;

/** `dark` = dark icons (for light screens), `light` = light icons (for dark screens). */
export function useStatusTone(tone: StatusTone) {
  const { setTone } = useContext(StatusCtx);
  useFocusEffect(
    useCallback(() => {
      setTone(tone);
      if (Platform.OS !== 'web') setStatusBarStyle(tone);
    }, [tone, setTone]),
  );
}

// ─── Screen scaffolding ─────────────────────────────────────────────────────

export function Screen({
  children,
  bg = colors.ivory100,
  scroll = true,
  padded = true,
  tone,
  contentStyle,
  footer,
  header,
  ...scrollProps
}: {
  children: React.ReactNode;
  bg?: string;
  scroll?: boolean;
  padded?: boolean;
  tone?: StatusTone;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
  header?: React.ReactNode;
} & ScrollViewProps) {
  const insets = useSafeAreaInsets();
  const dark = bg === colors.midnight || bg === colors.midnight800 || bg === colors.midnight900;
  useStatusTone(tone ?? (dark ? 'light' : 'dark'));
  const pad = padded ? space[5] : 0;
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ paddingTop: insets.top }}>{header}</View>
      {scroll ? (
        <ScrollView
          {...scrollProps}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            { paddingHorizontal: pad, paddingTop: header ? space[2] : space[4], paddingBottom: footer ? space[6] : insets.bottom + space[10] },
            contentStyle,
          ]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, paddingHorizontal: pad }, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <View
          style={{
            paddingHorizontal: space[5],
            paddingTop: space[3],
            paddingBottom: insets.bottom + space[4],
            backgroundColor: bg,
            borderTopWidth: 1,
            borderTopColor: dark ? colors.lineDark : colors.lineLight,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function Header({
  title,
  subtitle,
  right,
  tone = 'light',
  onBack,
  back = true,
  large,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  tone?: 'light' | 'dark';
  onBack?: () => void;
  back?: boolean;
  large?: boolean;
}) {
  const dark = tone === 'dark';
  const t = useT();
  return (
    <View style={{ paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: large ? space[2] : space[3] }}>
      <Row style={{ justifyContent: 'space-between', minHeight: 44 }}>
        {back ? (
          <IconButton
            icon={ArrowLeft}
            label={t('common.back')}
            tone={dark ? 'clearDark' : 'clear'}
            onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
            style={{ marginLeft: -10 }}
          />
        ) : (
          <View />
        )}
        {!large && title ? (
          <Txt v="title" color={dark ? colors.onDark : colors.ink} style={{ position: 'absolute', left: 56, right: 56, textAlign: 'center' }} numberOfLines={1}>
            {title}
          </Txt>
        ) : null}
        <Row style={{ gap: 8 }}>{right}</Row>
      </Row>
      {large && title ? (
        <View style={{ marginTop: space[3] }}>
          <Txt v="h1" color={dark ? colors.onDark : colors.ink} accessibilityRole="header">
            {title}
          </Txt>
          {subtitle ? (
            <Txt v="body" color={dark ? colors.onDarkMuted : colors.inkMuted} style={{ marginTop: 6 }}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ─── Toasts ─────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'info' | 'warning';
interface ToastMsg {
  id: number;
  text: string;
  kind: ToastKind;
}
const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children, top = 0 }: { children: React.ReactNode; top?: number }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const t = useT();
  const show = useCallback((text: string, kind: ToastKind = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setMsg({ id: Date.now(), text, kind });
    timer.current = setTimeout(() => setMsg(null), 2800);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const Icon = msg?.kind === 'warning' ? TriangleAlert : msg?.kind === 'info' ? Info : CheckCircle2;
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg ? (
        <Animated.View
          key={msg.id}
          entering={FadeInUp.springify().damping(16)}
          exiting={FadeOutUp.duration(180)}
          pointerEvents="box-none"
          style={{ position: 'absolute', top: top || insets.top + 8, left: 16, right: 16, alignItems: 'center', zIndex: 100 }}
        >
          <Row
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[
              {
                backgroundColor: colors.midnight,
                borderRadius: radius.pill,
                paddingLeft: 14,
                paddingRight: 8,
                paddingVertical: 8,
                gap: 10,
                maxWidth: 420,
              },
              shadow.float,
            ]}
          >
            <Icon size={18} color={msg.kind === 'warning' ? colors.warning : colors.lime} />
            <Txt v="smallStrong" color={colors.ivory} style={{ flexShrink: 1 }}>
              {msg.text}
            </Txt>
            <IconButton icon={X} label={t('common.closeNotice')} tone="clearDark" size={28} onPress={() => setMsg(null)} />
          </Row>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
