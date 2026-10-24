import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { MailCheck } from 'lucide-react-native';
import { Aurora } from '../brand/Aurora';
import { Wordmark } from '../brand/Brand';
import { Href, router } from 'expo-router';
import { Button, Tap } from '../ui/Button';
import { LanguagePicker } from '../ui/LanguagePicker';
import { Field, Row, Segmented } from '../ui/primitives';
import { TKey, useT } from '../../i18n';
import { Header, Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { useAuth } from '../../store/Auth';
import { useCountry } from '../../lib/country';
import { colors, radius, space } from '../../theme/tokens';

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
const digits = (s: string) => s.replace(/\D/g, '');

/**
 * Real account screen for passengers and drivers (Supabase e-mail + password).
 * Drivers also register their vehicle and the Nequi where passengers pay them.
 */
export function AuthForm({ role, onDone }: { role: 'passenger' | 'driver'; onDone: () => void }) {
  const { signIn, signUp, resetPassword } = useAuth();
  const { country } = useCountry();
  const t = useT();
  const dark = role === 'driver';
  const tone = dark ? 'dark' : 'light';
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');
  const [color, setColor] = useState('');
  const [nequi, setNequi] = useState('');
  // Validation errors are kept as dictionary keys so they follow a language switch;
  // server errors (already human text) are shown as they come.
  const [error, setError] = useState<{ key: TKey } | { text: string }>();
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const validate = (): TKey | undefined => {
    if (!isEmail(email)) return 'auth.err.email';
    if (password.length < 8) return 'auth.err.password';
    if (mode === 'signin') return undefined;
    if (name.trim().length < 3) return 'auth.err.name';
    if (!country.phoneValid(digits(phone))) return 'auth.err.phoneCO';
    if (role === 'driver') {
      if (!brand.trim() || !model.trim()) return 'auth.err.vehicle';
      if (!/^[A-Z]{3}\d{2}[A-Z0-9]$/.test(plate)) return 'auth.err.plateCO';
      if (nequi && !/^3\d{9}$/.test(digits(nequi))) return 'auth.err.nequi';
    }
    return undefined;
  };

  const submit = async () => {
    const v = validate();
    setError(v ? { key: v } : undefined);
    if (v) return;
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        onDone();
      } else {
        const needsConfirm = await signUp({
          email,
          password,
          fullName: name,
          phone: digits(phone),
          role,
          country: country.code,
          vehicle: role === 'driver' ? { brand: brand.trim(), model: model.trim(), plate, color: color.trim() } : undefined,
          payout: role === 'driver' ? { nequi: digits(nequi || phone) } : undefined,
        });
        if (needsConfirm) setSentTo(email.trim());
        else onDone();
      }
    } catch (e) {
      setError(e instanceof Error && e.message ? { text: e.message } : { key: 'common.somethingWrong' });
    } finally {
      setLoading(false);
    }
  };

  const forgot = async () => {
    setResetSent(null);
    if (!isEmail(email)) return setError({ key: 'auth.reset.needEmail' });
    setError(undefined);
    setResetting(true);
    try {
      await resetPassword(email);
      setResetSent(email.trim());
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(/rate|seconds|security/i.test(msg) ? { key: 'auth.reset.wait' } : msg ? { text: msg } : { key: 'common.somethingWrong' });
    } finally {
      setResetting(false);
    }
  };

  if (sentTo) {
    return (
      <Screen bg={dark ? colors.midnight : colors.ivory100} header={<Header tone={tone} onBack={() => setSentTo(null)} />}>
        <Animated.View entering={FadeIn} style={{ alignItems: 'center', paddingTop: space[10], gap: space[4] }}>
          <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
            <MailCheck size={36} color={colors.onLime} />
          </View>
          <Txt v="h1" align="center" color={dark ? colors.ivory : colors.ink}>
            {t('auth.checkEmail.title')}
          </Txt>
          <Txt v="body" align="center" color={dark ? colors.onDarkMuted : colors.inkMuted} style={{ maxWidth: 320 }}>
            {t('auth.checkEmail.body', { email: sentTo })}
          </Txt>
          <Button
            label={t('auth.checkEmail.confirmed')}
            variant="primary"
            onPress={() => {
              setSentTo(null);
              setMode('signin');
            }}
            style={{ marginTop: space[4], alignSelf: 'stretch' }}
          />
          <Txt v="caption" color={dark ? colors.onDarkFaint : colors.inkMuted} align="center">
            {t('auth.checkEmail.spam')}
          </Txt>
        </Animated.View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        bg={dark ? colors.midnight : colors.ivory100}
        backdrop={dark ? undefined : <Aurora layout="app" />}
        header={<Header tone={tone} />}
        footer={
          <View style={{ gap: 10 }}>
            <Button label={mode === 'signup' ? t('auth.createAccount') : t('auth.signIn')} variant="primary" loading={loading} onPress={submit} />
            <Tap haptics={false} onPress={() => router.push('/terminos' as Href)} accessibilityRole="link">
              <Txt v="caption" color={dark ? colors.onDarkFaint : colors.inkMuted} align="center" style={{ textDecorationLine: 'underline' }}>
                {t('auth.legal')}
              </Txt>
            </Tap>
          </View>
        }
      >
        <Row style={{ gap: 10, marginBottom: space[5] }}>
          <Wordmark height={26} color={dark ? colors.ivory : colors.midnight} />
          {dark ? (
            <View style={{ paddingHorizontal: 8, height: 22, borderRadius: 7, backgroundColor: colors.lime, justifyContent: 'center' }}>
              <Txt v="caption" color={colors.onLime}>
                {t('common.driverBadge')}
              </Txt>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          {/* Switch language before registering: every label below updates right away. */}
          <LanguagePicker tone={dark ? 'dark' : 'light'} compact />
        </Row>
        <Txt v="h1" color={dark ? colors.ivory : colors.midnight}>
          {mode === 'signup' ? (role === 'driver' ? t('auth.title.signupDriver') : t('auth.title.signupPax')) : t('auth.title.signin')}
        </Txt>
        <Txt v="body" color={dark ? colors.onDarkMuted : colors.inkMuted} style={{ marginTop: 6, marginBottom: space[5] }}>
          {mode === 'signup'
            ? role === 'driver'
              ? t('auth.sub.signupDriver')
              : t('auth.sub.signupPax', { city: country.cityLong })
            : t('auth.sub.signin')}
        </Txt>

        <Segmented
          tone={tone}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(undefined);
            setResetSent(null);
          }}
          options={[
            { value: 'signup', label: t('auth.createAccount') },
            { value: 'signin', label: t('auth.haveAccount') },
          ]}
          style={{ marginBottom: space[5] }}
        />

        <View style={{ gap: space[4] }}>
          {mode === 'signup' ? (
            <Field tone={tone} label={t('auth.field.name')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" placeholder={t('auth.field.namePh')} />
          ) : null}
          <Field
            tone={tone}
            label={t('auth.field.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder={t('auth.field.emailPh')}
          />
          {mode === 'signup' ? (
            <Field
              tone={tone}
              label={t('auth.field.phone')}
              prefix={country.phonePrefix}
              value={phone}
              onChangeText={(v) => setPhone(digits(v).slice(0, country.phoneMaxDigits))}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder={country.phonePlaceholder}
            />
          ) : null}
          <Field
            tone={tone}
            label={t('auth.field.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            textContentType={mode === 'signup' ? 'newPassword' : 'password'}
            placeholder={mode === 'signup' ? t('auth.field.passwordPh') : '••••••••'}
          />

          {mode === 'signup' && role === 'driver' ? (
            <View style={{ gap: space[4], marginTop: space[2], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.midnight700 }}>
              <Txt v="overline" color={colors.limeOnDark}>
                {t('auth.vehicle.title')}
              </Txt>
              <Row style={{ gap: 10 }}>
                <Field tone={tone} label={t('auth.field.brand')} value={brand} onChangeText={setBrand} placeholder="Mazda" style={{ flex: 1 }} />
                <Field tone={tone} label={t('auth.field.model')} value={model} onChangeText={setModel} placeholder={t('auth.field.modelPh')} style={{ flex: 1 }} />
              </Row>
              <Row style={{ gap: 10 }}>
                <Field
                  tone={tone}
                  label={t('common.plate')}
                  value={plate}
                  onChangeText={(v) => setPlate(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  autoCapitalize="characters"
                  placeholder="ABC123"
                  style={{ flex: 1 }}
                />
                <Field tone={tone} label={t('auth.field.color')} value={color} onChangeText={setColor} placeholder={t('auth.field.colorPh')} style={{ flex: 1 }} />
              </Row>
              <Field
                tone={tone}
                label={t('auth.field.nequi')}
                prefix="+57"
                value={nequi}
                onChangeText={(v) => setNequi(digits(v).slice(0, 10))}
                keyboardType="phone-pad"
                placeholder={t('auth.field.nequiPh')}
              />
            </View>
          ) : null}

          {error ? (
            <Txt v="small" color={dark ? colors.dangerOnDark : colors.dangerInk} accessibilityLiveRegion="polite">
              {'key' in error ? t(error.key) : error.text}
            </Txt>
          ) : null}
          {resetSent ? (
            <Txt v="small" color={dark ? colors.limeOnDark : colors.limeInk} accessibilityLiveRegion="polite">
              {t('auth.reset.sent', { email: resetSent })}
            </Txt>
          ) : null}
          {mode === 'signin' ? (
            <Tap haptics={false} onPress={forgot} accessibilityRole="link" disabled={resetting}>
              <Txt v="small" color={dark ? colors.onDarkMuted : colors.inkMuted} style={{ textDecorationLine: 'underline' }}>
                {t('auth.forgot')}
              </Txt>
            </Tap>
          ) : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
