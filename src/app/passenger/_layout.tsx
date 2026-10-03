import React, { useMemo } from 'react';
import { Stack } from 'expo-router';
import { PhoneFrame, ScreenGroup } from '../../components/device/PhoneFrame';
import { useT } from '../../i18n';
import { colors } from '../../theme/tokens';

export default function PassengerLayout() {
  const t = useT();
  const groups: ScreenGroup[] = useMemo(
    () => [
      {
        title: t('pax.frame.access'),
        items: [
          { label: 'Splash', href: '/passenger' },
          { label: 'Onboarding', href: '/passenger/onboarding' },
          { label: t('pax.frame.auth'), href: '/passenger/auth' },
        ],
      },
      {
        title: t('common.trip'),
        items: [
          { label: t('pax.frame.homeMap'), href: '/passenger/home' },
          { label: t('pax.frame.search'), href: '/passenger/search' },
          { label: t('pax.saved.title'), href: '/passenger/saved' },
          { label: t('pax.frame.rideFlow'), href: '/passenger/ride' },
        ],
      },
      {
        title: t('pax.frame.account'),
        items: [
          { label: t('pax.frame.history'), href: '/passenger/trips' },
          { label: t('pax.profile.payments'), href: '/passenger/wallet' },
          { label: t('common.profile'), href: '/passenger/profile' },
          { label: t('common.safetyCenter'), href: '/passenger/safety' },
          { label: t('pax.profile.help'), href: '/passenger/help' },
        ],
      },
    ],
    [t],
  );

  return (
    <PhoneFrame app={t('pax.frame.app')} description={t('pax.frame.description')} groups={groups}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.ivory100 },
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="search" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="ride" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
    </PhoneFrame>
  );
}
