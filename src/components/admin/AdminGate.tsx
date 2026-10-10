import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeft, Lock, LogOut, ShieldX } from 'lucide-react-native';
import { BrandRings, Wordmark } from '../brand/Brand';
import { Button, IconButton, Tap } from '../ui/Button';
import { Field, Row } from '../ui/primitives';
import { useToast } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { backendEnabled, fetchMyRole, Role, supabase } from '../../lib/supabase';
import { isAdminSite } from '../../lib/site';
import { colors, space } from '../../theme/tokens';
import { useWide } from './AdminKit';

interface AdminSession {
  email: string | null;
  backend: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AdminSession>({ email: null, backend: false, signOut: async () => {} });
export const useAdminSession = () => useContext(Ctx);

function LoginScreen() {
  const wide = useWide(900);
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [confirm, setConfirm] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!supabase) return;
    setError(undefined);
    if (mode === 'signup') {
      if (password.length < 8) return setError('Usa al menos 8 caracteres');
      if (password !== confirm) return setError('Las contraseñas no coinciden');
    }
    setLoading(true);
    if (mode === 'signin') {
      const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setLoading(false);
      if (e) setError(e.message.includes('Invalid') ? 'Correo o contraseña incorrectos' : e.message.includes('not confirmed') ? 'Confirma tu correo primero: revisa tu bandeja de entrada' : e.message);
      return;
    }
    // The role is decided by the server: only founding admin emails become admin.
    const { data, error: e } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/admin` : undefined },
    });
    setLoading(false);
    if (e) return setError(e.message.includes('registered') ? 'Ese correo ya tiene cuenta. Inicia sesión' : e.message);
    // Existing email: Supabase says OK without creating anything (no identities).
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return setError('Ese correo ya tiene cuenta. Inicia sesión');
    if (!data.session) setSent(true);
  };

  if (sent) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], backgroundColor: colors.ivory100, gap: space[4] }}>
        <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
          <Lock size={30} color={colors.midnight} />
        </View>
        <Txt v="h2" align="center">
          Revisa tu correo
        </Txt>
        <Txt v="body" color={colors.inkMuted} align="center" style={{ maxWidth: 380 }}>
          Enviamos un enlace de confirmación a {email.trim()}. Ábrelo y luego inicia sesión aquí con tu contraseña.
        </Txt>
        <Button
          label="Ya confirmé, iniciar sesión"
          variant="dark"
          size="md"
          full={false}
          onPress={() => {
            setSent(false);
            setMode('signin');
          }}
        />
      </View>
    );
  }

  const reset = async () => {
    if (!supabase || !email.includes('@')) return setError('Escribe tu correo para enviarte el enlace');
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (e) setError(e.message);
    else toast('Te enviamos un enlace para crear una nueva contraseña', 'info');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', backgroundColor: colors.ivory100 }}>
        <View style={{ flex: wide ? 1 : undefined, backgroundColor: colors.midnight, padding: wide ? 64 : space[6], paddingTop: wide ? 64 : space[12], justifyContent: 'space-between', overflow: 'hidden', minHeight: wide ? undefined : 260 }}>
          <View pointerEvents="none" style={{ position: 'absolute', right: -180, bottom: -180, opacity: 0.8 }}>
            <BrandRings size={560} />
          </View>
          <Row style={{ gap: 12 }}>
            {isAdminSite ? null : <IconButton icon={ArrowLeft} label="Volver" tone="dark" onPress={() => router.replace('/')} />}
            <Wordmark height={26} color={colors.ivory} />
          </Row>
          <View style={{ marginTop: space[8] }}>
            <Txt v="overline" color={colors.lime}>
              Consola de operaciones
            </Txt>
            <Txt v={wide ? 'display' : 'h1'} color={colors.ivory} style={{ marginTop: 10, maxWidth: 460 }}>
              Tarifas, conductores y ciudad en un solo lugar.
            </Txt>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: wide ? 64 : space[6] }}>
          <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center', gap: space[4] }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={22} color={colors.lime} />
            </View>
            <View>
              <Txt v="h1">{mode === 'signin' ? 'Inicia sesión' : 'Crea tu cuenta'}</Txt>
              <Txt v="body" color={colors.inkMuted} style={{ marginTop: 6 }}>
                {mode === 'signin' ? 'Acceso solo para administradores de NÜVA.' : 'Solo los correos autorizados reciben permisos de administrador.'}
              </Txt>
            </View>
            <Field label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" placeholder="tu@correo.com" />
            <Field
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              textContentType={mode === 'signin' ? 'password' : 'newPassword'}
              placeholder={mode === 'signin' ? '••••••••' : 'Mínimo 8 caracteres'}
              onSubmitEditing={mode === 'signin' ? submit : undefined}
              error={mode === 'signin' ? error : undefined}
            />
            {mode === 'signup' ? (
              <Field
                label="Repite la contraseña"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                placeholder="••••••••"
                onSubmitEditing={submit}
                error={error}
              />
            ) : null}
            <Button
              label={mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
              variant="dark"
              loading={loading}
              disabled={!email.includes('@') || password.length < 6}
              onPress={submit}
            />
            <Row style={{ justifyContent: 'center', gap: 18 }}>
              <Tap
                onPress={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError(undefined);
                }}
                style={{ padding: 6 }}
                haptics={false}
              >
                <Txt v="smallStrong" style={{ textDecorationLine: 'underline' }}>
                  {mode === 'signin' ? 'Crear cuenta' : 'Ya tengo cuenta'}
                </Txt>
              </Tap>
              {mode === 'signin' ? (
                <Tap onPress={reset} style={{ padding: 6 }} haptics={false}>
                  <Txt v="smallStrong" color={colors.inkMuted} style={{ textDecorationLine: 'underline' }}>
                    ¿Olvidaste tu contraseña?
                  </Txt>
                </Tap>
              ) : null}
            </Row>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function Forbidden({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], backgroundColor: colors.ivory100, gap: space[4] }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
        <ShieldX size={32} color={colors.dangerInk} />
      </View>
      <Txt v="h2" align="center">
        Esta cuenta no es administradora
      </Txt>
      <Txt v="body" color={colors.inkMuted} align="center" style={{ maxWidth: 380 }}>
        {email} no tiene permisos para la consola. Pídele a un administrador que te asigne el rol.
      </Txt>
      <Button label="Cerrar sesión" icon={LogOut} variant="outline" size="md" full={false} onPress={onSignOut} />
    </View>
  );
}

/**
 * Protects the admin area. With a backend: real Supabase session + role check
 * (the database enforces the same rule on every admin function). Without one:
 * the prototype stays open in demo mode.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(!backendEnabled);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Re-check the role only when the signed-in USER changes. auth-js also emits events on
  // tab focus and hourly token refresh; reacting to those unmounted the whole console
  // (losing unsaved pricing drafts, open dialogs and filters).
  const userId = session?.user.id;
  const [roleError, setRoleError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!userId) {
      setRole(null);
      return;
    }
    setReady(false);
    fetchMyRole()
      .then((r) => {
        setRole(r);
        setRoleError(false);
      })
      .catch(() => setRoleError(true))
      .finally(() => setReady(true));
  }, [userId, attempt]);

  const signOut = async () => {
    await supabase?.auth.signOut();
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ivory100 }}>
        <ActivityIndicator color={colors.midnight} />
      </View>
    );
  }
  if (backendEnabled && !session) return <LoginScreen />;
  // A network failure isn't "not an admin": say so and offer to retry.
  if (backendEnabled && roleError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ivory100, gap: 12, padding: 24 }}>
        <Txt v="h3" align="center">
          No se pudo verificar tu acceso
        </Txt>
        <Txt v="body" align="center" color={colors.inkMuted}>
          Revisa tu conexión a internet y vuelve a intentarlo.
        </Txt>
        <Button label="Reintentar" variant="dark" size="md" full={false} onPress={() => setAttempt((a) => a + 1)} />
      </View>
    );
  }
  if (backendEnabled && role !== 'admin') return <Forbidden email={session?.user.email ?? ''} onSignOut={signOut} />;

  return <Ctx.Provider value={{ email: session?.user.email ?? null, backend: backendEnabled, signOut }}>{children}</Ctx.Provider>;
}
