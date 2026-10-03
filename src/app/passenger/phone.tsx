import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { MessageCircle, Smartphone } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { Row, Segmented } from '../../components/ui/primitives';
import { Header, Screen } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { useT } from '../../i18n';
import { useApp } from '../../store/AppStore';
import { colors, fonts, radius, space } from '../../theme/tokens';

/** "3104827719" → "310 482 7719" */
const formatPhone = (d: string) => [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(' ');

function Flag() {
  return (
    <View style={{ width: 24, height: 16, borderRadius: 3, overflow: 'hidden' }} accessibilityLabel="Colombia">
      <View style={{ flex: 2, backgroundColor: '#FCD116' }} />
      <View style={{ flex: 1, backgroundColor: '#003893' }} />
      <View style={{ flex: 1, backgroundColor: '#CE1126' }} />
    </View>
  );
}

export default function PhoneAuth() {
  const { setPhone } = useApp();
  const t = useT();
  const [digits, setDigits] = useState('');
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('whatsapp');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const valid = /^3\d{9}$/.test(digits);
  const error = touched && digits.length > 0 && !valid ? (digits[0] !== '3' ? t('pax.phone.errPrefix') : t('pax.phone.errLength')) : undefined;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    setLoading(true);
    setPhone(`+57 ${formatPhone(digits)}`);
    setTimeout(() => {
      setLoading(false);
      router.push({ pathname: '/passenger/otp', params: { channel } });
    }, 900);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        bg={colors.ivory100}
        header={<Header />}
        footer={
          <View style={{ gap: 12 }}>
            <Button
              label={channel === 'whatsapp' ? t('pax.phone.sendWhatsapp') : t('pax.phone.sendSms')}
              onPress={submit}
              loading={loading}
              disabled={digits.length < 10}
            />
            <Txt v="caption" color={colors.inkMuted} align="center">
              {t('auth.legal')}
            </Txt>
          </View>
        }
      >
        <Txt v="overline" color={colors.inkMuted}>
          {t('pax.verify.step', { n: 1, total: 2 })}
        </Txt>
        <Txt v="h1" style={{ marginTop: 10 }}>
          {t('pax.phone.title')}
        </Txt>
        <Txt v="body" color={colors.inkMuted} style={{ marginTop: 8 }}>
          {t('pax.phone.body')}
        </Txt>

        <Row
          style={{
            marginTop: space[8],
            height: 68,
            borderRadius: radius.lg,
            backgroundColor: colors.white,
            borderWidth: 2,
            borderColor: error ? colors.danger : digits.length ? colors.midnight : colors.lineLightStrong,
            paddingHorizontal: 16,
            gap: 12,
          }}
        >
          <Row style={{ gap: 8, paddingRight: 12, borderRightWidth: 1, borderRightColor: colors.lineLightStrong, height: 32 }}>
            <Flag />
            <Txt v="title">+57</Txt>
          </Row>
          <TextInput
            autoFocus
            value={formatPhone(digits)}
            onChangeText={(t) => setDigits(t.replace(/\D/g, '').slice(0, 10))}
            onBlur={() => setTouched(true)}
            onSubmitEditing={submit}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            placeholder="300 000 0000"
            placeholderTextColor={colors.ivory400}
            accessibilityLabel={t('pax.phone.numberA11y')}
            style={[{ flex: 1, height: '100%', fontFamily: fonts.bold, fontSize: 24, letterSpacing: 0.5, color: colors.ink, fontVariant: ['tabular-nums'] }, { outlineStyle: 'none' } as object]}
          />
        </Row>
        {error ? (
          <Txt v="small" color={colors.dangerInk} style={{ marginTop: 8 }} accessibilityLiveRegion="polite">
            {error}
          </Txt>
        ) : null}

        <Txt v="caption" color={colors.inkMuted} style={{ marginTop: space[6], marginBottom: 8 }}>
          {t('pax.phone.channelQ')}
        </Txt>
        <Segmented
          value={channel}
          onChange={setChannel}
          options={[
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'sms', label: t('pax.phone.sms') },
          ]}
        />
        <Row style={{ gap: 10, marginTop: space[6], padding: 14, borderRadius: radius.md, backgroundColor: colors.ivory200 }}>
          {channel === 'whatsapp' ? <MessageCircle size={18} color={colors.ink} /> : <Smartphone size={18} color={colors.ink} />}
          <Txt v="small" color={colors.inkSoft} style={{ flex: 1 }}>
            {channel === 'whatsapp' ? t('pax.phone.whatsappNote') : t('pax.phone.smsNote')}
          </Txt>
        </Row>
      </Screen>
    </KeyboardAvoidingView>
  );
}
