import React, { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { haptic, Tap } from '../../components/ui/Button';
import { Row } from '../../components/ui/primitives';
import { Header, Screen, useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { useT } from '../../i18n';
import { useCountdown } from '../../lib/hooks';
import { useApp } from '../../store/AppStore';
import { colors, fonts, radius, space } from '../../theme/tokens';

const LEN = 6;

export default function OtpVerification() {
  const { channel } = useLocalSearchParams<{ channel?: string }>();
  const { phone, signIn } = useApp();
  const toast = useToast();
  const t = useT();
  const input = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'error' | 'ok'>('idle');
  const [resendKey, setResendKey] = useState(0);
  const left = useCountdown(30, true, resendKey);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  useEffect(() => {
    if (code.length !== LEN) return;
    setState('checking');
    const id = setTimeout(() => {
      // Prototype rule: any code works except 000000, which demos the error state.
      if (code === '000000') {
        setState('error');
        haptic('warning');
        shake.value = withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 }));
        return;
      }
      setState('ok');
      haptic('success');
      setTimeout(() => {
        signIn();
        toast(t('pax.otp.welcome', { name: 'Valentina' }));
        router.replace('/passenger/home');
      }, 700);
    }, 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <Screen header={<Header />}>
      <Txt v="overline" color={colors.inkMuted}>
        {t('pax.verify.step', { n: 2, total: 2 })}
      </Txt>
      <Txt v="h1" style={{ marginTop: 10 }}>
        {t('pax.otp.title')}
      </Txt>
      <Txt v="body" color={colors.inkMuted} style={{ marginTop: 8 }}>
        {t('pax.otp.sentVia', { channel: channel === 'sms' ? 'SMS' : 'WhatsApp' })} <Txt v="bodyStrong">{phone || '+57 310 482 7719'}</Txt>
      </Txt>

      <Pressable onPress={() => input.current?.focus()} accessibilityLabel={t('pax.otp.codeA11y')}>
        <Animated.View style={[{ flexDirection: 'row', gap: 8, marginTop: space[8] }, shakeStyle]}>
          {Array.from({ length: LEN }).map((_, i) => {
            const ch = code[i];
            const active = i === code.length && state === 'idle';
            const border = state === 'error' ? colors.danger : state === 'ok' ? colors.midnight : active ? colors.midnight : ch ? colors.ivory400 : colors.lineLightStrong;
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 64,
                  borderRadius: radius.md,
                  backgroundColor: state === 'ok' ? colors.lime : colors.white,
                  borderWidth: 2,
                  borderColor: border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt style={{ fontFamily: fonts.extrabold, fontSize: 26 }}>{ch ?? ''}</Txt>
                {active ? <View style={{ position: 'absolute', bottom: 14, width: 16, height: 2.5, borderRadius: 2, backgroundColor: colors.midnight }} /> : null}
              </View>
            );
          })}
        </Animated.View>
      </Pressable>
      <TextInput
        ref={input}
        autoFocus
        value={code}
        onChangeText={(t) => {
          if (state === 'error') setState('idle');
          setCode(t.replace(/\D/g, '').slice(0, LEN));
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={LEN}
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
        accessibilityLabel={t('pax.otp.codeLabel')}
      />

      <View style={{ minHeight: 28, marginTop: space[4] }} accessibilityLiveRegion="polite">
        {state === 'checking' ? (
          <Txt v="small" color={colors.inkMuted}>
            {t('pax.otp.checking')}
          </Txt>
        ) : state === 'error' ? (
          <Txt v="small" color={colors.dangerInk}>
            {t('pax.otp.wrong')}
          </Txt>
        ) : state === 'ok' ? (
          <Animated.View entering={ZoomIn}>
            <Row style={{ gap: 6 }}>
              <Check size={16} color={colors.limeInk} strokeWidth={3} />
              <Txt v="smallStrong" color={colors.limeInk}>
                {t('pax.otp.verified')}
              </Txt>
            </Row>
          </Animated.View>
        ) : null}
      </View>

      <Row style={{ marginTop: space[4], gap: 6 }}>
        <Txt v="small" color={colors.inkMuted}>
          {t('pax.otp.notReceived')}
        </Txt>
        {left > 0 ? (
          <Txt v="smallStrong" color={colors.inkMuted} tabular>
            {t('pax.otp.resendIn', { time: `0:${Math.ceil(left).toString().padStart(2, '0')}` })}
          </Txt>
        ) : (
          <Tap
            onPress={() => {
              setResendKey((k) => k + 1);
              setCode('');
              setState('idle');
              toast(t('pax.otp.resent'), 'info');
            }}
          >
            <Txt v="smallStrong" style={{ textDecorationLine: 'underline' }}>
              {t('pax.otp.resend')}
            </Txt>
          </Tap>
        )}
      </Row>
      <View style={{ marginTop: space[8], padding: 14, borderRadius: radius.md, backgroundColor: colors.ivory200 }}>
        <Txt v="caption" color={colors.inkSoft}>
          {t('pax.otp.protoNote')}
        </Txt>
      </View>
    </Screen>
  );
}
