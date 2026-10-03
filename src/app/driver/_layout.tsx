import React, { useMemo } from 'react';
import { Stack } from 'expo-router';
import { PhoneFrame, ScreenGroup } from '../../components/device/PhoneFrame';
import { useT } from '../../i18n';
import { colors } from '../../theme/tokens';
import { commissionText } from '../../lib/fare';
import { useApp } from '../../store/AppStore';

export default function DriverLayout() {
  const { pricing } = useApp();
  const t = useT();
  const groups: ScreenGroup[] = useMemo(
    () => [
      {
        title: t('drv.frame.signup'),
        items: [
          { label: 'Onboarding', href: '/driver/onboarding' },
          { label: t('drv.profile.identity'), href: '/driver/verify' },
          { label: t('drv.frame.vehicle'), href: '/driver/vehicle' },
          { label: t('drv.frame.documents'), href: '/driver/documents' },
        ],
      },
      {
        title: t('drv.frame.operation'),
        items: [
          { label: 'Dashboard', href: '/driver/home' },
          { label: t('drv.frame.rideFlow'), href: '/driver/ride' },
          { label: t('drv.frame.history'), href: '/driver/trips' },
        ],
      },
      {
        title: t('drv.frame.money'),
        items: [
          { label: t('tabs.earnings'), href: '/driver/earnings' },
          { label: t('drv.withdraw.title'), href: '/driver/withdraw' },
        ],
      },
      {
        title: t('drv.frame.account'),
        items: [
          { label: t('common.profile'), href: '/driver/profile' },
          { label: t('drv.profile.ratings'), href: '/driver/ratings' },
          { label: t('drv.support.title'), href: '/driver/support' },
        ],
      },
    ],
    [t],
  );

  return (
    <PhoneFrame
      app={t('drv.frame.app')}
      description={t('drv.frame.description', { commission: commissionText(pricing) })}
      groups={groups}
      initialTone="light"
    >
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.midnight },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="ride" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
      </Stack>
    </PhoneFrame>
  );
}
