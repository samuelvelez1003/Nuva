import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { backendEnabled, Role, supabase } from '../lib/supabase';
import { CUSTOMER_URL } from '../lib/site';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: Role;
  driver_status: 'pendiente' | 'aprobado' | 'suspendido' | null;
  vehicle: {
    brand?: string;
    model?: string;
    plate?: string;
    color?: string;
    /** Curaçao drivers: driving licence number and insurance expiry (YYYY-MM-DD). */
    license?: string;
    insuranceUntil?: string;
  } | null;
  /** Where passengers pay the driver directly: Nequi (Colombia) or a bank account (Curaçao). */
  payout: { nequi?: string; bank?: string } | null;
  rating: number;
  /** Public URL of the profile photo (Supabase Storage "avatars"). */
  avatar_url?: string | null;
  country?: 'CO' | 'CW';
}

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: 'passenger' | 'driver';
  country: 'CO' | 'CW';
  vehicle?: Profile['vehicle'];
  payout?: Profile['payout'];
}

interface AuthState {
  /** True when Supabase is configured: real accounts are required. */
  live: boolean;
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  refreshProfile: () => Promise<Profile | null>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Resolves with true when a confirmation e-mail was sent (no session yet). */
  signUp: (input: SignUpInput) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

/** Supabase error → Spanish, user-facing. */
export function authErrorEs(message: string) {
  if (message.includes('Invalid login')) return 'Correo o contraseña incorrectos';
  if (message.includes('not confirmed')) return 'Confirma tu correo primero: revisa tu bandeja de entrada';
  if (message.includes('already registered')) return 'Ese correo ya tiene cuenta. Inicia sesión';
  if (message.includes('rate limit')) return 'Demasiados intentos. Espera unos minutos';
  if (message.includes('Password')) return 'La contraseña debe tener al menos 8 caracteres';
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(!backendEnabled);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!supabase || !s) {
      setProfile(null);
      return null;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).single();
    setProfile((data as Profile) ?? null);
    return (data as Profile) ?? null;
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      loadProfile(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(authErrorEs(error.message));
  }, []);

  const signUp = useCallback(async (i: SignUpInput) => {
    if (!supabase) return false;
    const { data, error } = await supabase.auth.signUp({
      email: i.email.trim(),
      password: i.password,
      options: {
        // Confirmation lands on the public site, which tells the user to go back to the app.
        emailRedirectTo: Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/verificado` : `${CUSTOMER_URL}/verificado`,
        // The database trigger copies these into the profile (role is re-checked server-side).
        data: { full_name: i.fullName.trim(), phone: i.phone, role: i.role, country: i.country, vehicle: i.vehicle ?? null, payout: i.payout ?? null },
      },
    });
    if (error) throw new Error(authErrorEs(error.message));
    return !data.session;
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  return (
    <Ctx.Provider value={{ live: backendEnabled, ready, session, profile, refreshProfile: () => loadProfile(session), signIn, signUp, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
