import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useStatusTone } from '../components/ui/Screen';
import Landing from '../components/landing/Landing';
import { isAdminSite } from '../lib/site';
import { useAuth } from '../store/Auth';
import { colors } from '../theme/tokens';
import Launcher from './demo';

/**
 * Web customer site (nuva.expo.app): public landing page.
 * Web admin site (admin alias): straight to the console.
 * Native app: a signed-in account goes straight to its own mode (passenger or
 * driver); the launcher is only for choosing how to sign up.
 */
export default function Home() {
  const { live, ready, session, profile } = useAuth();
  const loading = live && (!ready || (!!session && !profile));
  // Dark icons: the loading screen, the landing and the launcher are all on the light Aurora ground.
  useStatusTone('dark');
  // Web: the public landing page (NÜVA operates only in Colombia).
  if (Platform.OS === 'web') return isAdminSite ? <Redirect href="/admin" /> : <Landing />;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ivory100, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.lime} />
      </View>
    );
  }
  if (live && session && profile?.role === 'passenger') return <Redirect href="/passenger" />;
  if (live && session && profile?.role === 'driver') return <Redirect href="/driver" />;
  return <Launcher />;
}
