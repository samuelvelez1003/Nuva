import React, { useMemo } from 'react';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Clock3, House, UserRound, Wallet } from 'lucide-react-native';
import { FloatingTabBar, TabMeta } from '../../../components/ui/TabBar';
import { useT } from '../../../i18n';
import { useAuth } from '../../../store/Auth';

export default function PassengerTabs() {
  const { live, ready, session, profile } = useAuth();
  const t = useT();
  const meta: TabMeta = useMemo(
    () => ({
      home: { label: t('tabs.home'), icon: House },
      trips: { label: t('tabs.trips'), icon: Clock3 },
      wallet: { label: t('tabs.wallet'), icon: Wallet },
      profile: { label: t('tabs.profile'), icon: UserRound },
    }),
    [t],
  );
  // With the backend on, the passenger app requires a real account…
  if (live && ready && !session) return <Redirect href="/passenger/onboarding" />;
  // …and a driver account always lives in driver mode.
  if (live && profile?.role === 'driver') return <Redirect href="/driver" />;
  return (
    <Tabs screenOptions={{ headerShown: false, animation: 'fade' }} tabBar={(p) => <FloatingTabBar {...p} meta={meta} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="trips" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
