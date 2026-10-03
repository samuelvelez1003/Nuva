import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useApp } from '../../store/AppStore';
import { useAuth } from '../../store/Auth';
import { colors } from '../../theme/tokens';

/** Routes a driver to sign-up, review, or the dashboard depending on their account. */
export default function DriverEntry() {
  const { driverOnboarded } = useApp();
  const { live, ready, session, profile } = useAuth();

  if (!live) return <Redirect href={driverOnboarded ? '/driver/home' : '/driver/onboarding'} />;
  if (!ready || (session && !profile)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.lime} />
      </View>
    );
  }
  if (!session) return <Redirect href="/driver/onboarding" />;
  // A passenger account always lives in passenger mode.
  if (profile?.role === 'passenger') return <Redirect href="/passenger/home" />;
  if (profile?.role === 'admin' || (profile?.role === 'driver' && profile.driver_status === 'aprobado')) return <Redirect href="/driver/home" />;
  return <Redirect href="/driver/pending" />;
}
