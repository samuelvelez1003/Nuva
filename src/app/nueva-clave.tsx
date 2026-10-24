import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { CheckCircle2, KeyRound, LinkIcon } from 'lucide-react-native';
import { Wordmark } from '../components/brand/Brand';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/primitives';
import { useStatusTone } from '../components/ui/Screen';
import { Txt } from '../components/ui/Txt';
import { TKey, useT } from '../i18n';
import { AUTH_LINK, supabase } from '../lib/supabase';
import { colors, space } from '../theme/tokens';

/**
 * Landing page for the password-reset email of passengers and drivers (the native
 * apps send the link here too). The link signs the user in for this page only: they
 * pick a new password, we sign out, and they go back to the app to sign in with it.
 */
export default function NewPassword() {
  useStatusTone('light');
  const t = useT();
  const [state, setState] = useState<'checking' | 'form' | 'expired' | 'done'>(AUTH_LINK.recovery && supabase ? 'checking' : 'expired');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<TKey | string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase || !AUTH_LINK.recovery) return;
    const show = (s: Session | null) => {
      if (!s) return;
      setEmail(s.user.email ?? '');
      setState('form');
    };
    supabase.auth.getSession().then(({ data }) => (data.session ? show(data.session) : setState('expired')));
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === 'PASSWORD_RECOVERY') show(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const save = async () => {
    if (!supabase) return;
    if (password.length < 8) return setError('auth.err.password');
    if (password !== confirm) return setError('reset.err.match');
    setError(undefined);
    setLoading(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    if (e) {
      setLoading(false);
      return setError(/different/i.test(e.message) ? 'reset.err.same' : e.message);
    }
    await supabase.auth.signOut();
    setLoading(false);
    setState('done');
  };

  const errorText = error ? (error.includes(' ') ? error : t(error as TKey)) : undefined;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.midnight }} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: space[6] }}>
        <View style={{ width: '100%', maxWidth: 400, alignItems: 'center', gap: space[5] }}>
          <Wordmark height={28} color={colors.ivory} />

          {state === 'checking' ? (
            <View style={{ alignItems: 'center', gap: space[3], marginTop: space[6] }}>
              <ActivityIndicator color={colors.lime} />
              <Txt v="body" color={colors.onDarkMuted}>
                {t('reset.checking')}
              </Txt>
            </View>
          ) : null}

          {state === 'form' ? (
            <View style={{ width: '100%', gap: space[4], marginTop: space[4] }}>
              <View style={{ alignSelf: 'center', width: 64, height: 64, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
                <KeyRound size={28} color={colors.midnight} />
              </View>
              <View style={{ alignItems: 'center' }}>
                <Txt v="h1" align="center" color={colors.ivory}>
                  {t('reset.title')}
                </Txt>
                {email ? (
                  <Txt v="body" align="center" color={colors.onDarkMuted} style={{ marginTop: 6 }}>
                    {t('reset.subtitle', { email })}
                  </Txt>
                ) : null}
              </View>
              <Field tone="dark" label={t('reset.field.new')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" placeholder={t('auth.field.passwordPh')} />
              <Field
                tone="dark"
                label={t('reset.field.confirm')}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                placeholder="••••••••"
                onSubmitEditing={save}
              />
              {errorText ? (
                <Txt v="small" color={colors.danger} accessibilityLiveRegion="polite">
                  {errorText}
                </Txt>
              ) : null}
              <Button label={t('reset.save')} loading={loading} disabled={password.length < 8 || !confirm} onPress={save} />
            </View>
          ) : null}

          {state === 'done' || state === 'expired' ? (
            <View style={{ alignItems: 'center', gap: space[4], marginTop: space[6] }}>
              <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: state === 'done' ? colors.lime : colors.midnight600, alignItems: 'center', justifyContent: 'center' }}>
                {state === 'done' ? <CheckCircle2 size={44} color={colors.midnight} /> : <LinkIcon size={38} color={colors.lime} />}
              </View>
              <Txt v="h1" align="center" color={colors.ivory}>
                {t(state === 'done' ? 'reset.done.title' : 'reset.expired.title')}
              </Txt>
              <Txt v="body" align="center" color={colors.onDarkMuted} style={{ maxWidth: 360 }}>
                {t(state === 'done' ? 'reset.done.body' : 'reset.expired.body')}
              </Txt>
              <Button label={t('reset.home')} full={false} onPress={() => router.replace('/')} style={{ marginTop: space[2] }} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
