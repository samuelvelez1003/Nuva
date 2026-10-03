import React from 'react';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { CircleDollarSign, Gauge, History, UserRound } from 'lucide-react-native';
import { FloatingTabBar, TabMeta } from '../../../components/ui/TabBar';
import { useAuth } from '../../../store/Auth';

const META: TabMeta = {
  home: { label: 'tabs.home', icon: Gauge },
  earnings: { label: 'tabs.earnings', icon: CircleDollarSign },
  trips: { label: 'tabs.trips', icon: History },
  profile: { label: 'tabs.profile', icon: UserRound },
};

export default function DriverTabs() {
  const { live, ready, session, profile } = useAuth();
  const approved = profile?.role === 'admin' || (profile?.role === 'driver' && profile.driver_status === 'aprobado');
  // With the backend on, only a confirmed, approved driver reaches the dashboard —
  // never while the session or profile is still loading (that showed the demo driver).
  if (live && (!ready || !session || !profile || !approved)) return <Redirect href="/driver" />;
  return (
    <Tabs screenOptions={{ headerShown: false, animation: 'fade' }} tabBar={(p) => <FloatingTabBar {...p} meta={META} tone="raised" />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="earnings" />
      <Tabs.Screen name="trips" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
