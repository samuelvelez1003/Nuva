import React from 'react';
import { ScrollView, View } from 'react-native';
import { Href, router, Slot, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Car,
  HandCoins,
  Headset,
  Landmark,
  LayoutDashboard,
  LogOut,
  Map,
  Megaphone,
  Radar,
  ScanFace,
  SlidersHorizontal,
  Users,
} from 'lucide-react-native';
import { useWide } from '../../components/admin/AdminKit';
import { AdminGate, useAdminSession } from '../../components/admin/AdminGate';
import { IconButton } from '../../components/ui/Button';
import { Wordmark } from '../../components/brand/Brand';
import { Tap } from '../../components/ui/Button';
import { Avatar, Badge, LiveDot, Row } from '../../components/ui/primitives';
import { StatusToneProvider, ToastProvider, useStatusTone } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { useAdminSelfies, useAdminWithdrawals, useTickets } from '../../lib/adminData';
import { useCountry } from '../../lib/country';
import { useApp } from '../../store/AppStore';
import { colors, radius, space } from '../../theme/tokens';

const ADMIN_NAV = [
  { href: '/admin', label: 'Resumen', icon: LayoutDashboard },
  { href: '/admin/pricing', label: 'Tarifas y comisión', icon: SlidersHorizontal },
  { href: '/admin/trips', label: 'Monitoreo de viajes', icon: Radar },
  { href: '/admin/drivers', label: 'Conductores', icon: Car },
  { href: '/admin/identity', label: 'Identidad', icon: ScanFace },
  { href: '/admin/payouts', label: 'Retiros', icon: HandCoins },
  { href: '/admin/passengers', label: 'Pasajeros', icon: Users },
  { href: '/admin/zones', label: 'Zonas de servicio', icon: Map },
  { href: '/admin/promos', label: 'Promociones', icon: Megaphone },
  { href: '/admin/banks', label: 'Cuentas bancarias', icon: Landmark },
  { href: '/admin/support', label: 'Soporte', icon: Headset },
];

function Sidebar() {
  const { country } = useCountry();
  const path = usePathname();
  const { pricingVersion } = useApp();
  const admin = useAdminSession();
  const { rows: tickets } = useTickets();
  const open = (tickets ?? []).filter((t) => t.status !== 'resuelto').length;
  // Work waiting for the team: withdrawals to pay and identity selfies to review.
  const { rows: payouts } = useAdminWithdrawals('procesando');
  const { rows: selfies } = useAdminSelfies('pendiente');
  const pending: Record<string, number> = { '/admin/support': open, '/admin/payouts': payouts?.length ?? 0, '/admin/identity': selfies?.length ?? 0 };
  return (
    <View style={{ width: 256, backgroundColor: colors.midnight, paddingVertical: space[6], paddingHorizontal: space[4], justifyContent: 'space-between' }}>
      <View>
        <Row style={{ gap: 10, paddingHorizontal: space[2] }}>
          <Tap haptics={false} onPress={() => router.navigate('/')} accessibilityLabel="Inicio">
            <Wordmark height={28} color={colors.ivory} />
          </Tap>
          <Badge label="Admin" tone="lime" />
        </Row>
        <View style={{ marginTop: space[6], gap: 2 }}>
          {ADMIN_NAV.map((n) => {
            const active = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
            return (
              <Tap key={n.href} haptics={false} scaleTo={0.98} onPress={() => router.navigate(n.href as Href)} accessibilityState={{ selected: active }}>
                <Row style={{ gap: 12, height: 44, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: active ? colors.midnight600 : 'transparent' }}>
                  <n.icon size={18} color={active ? colors.limeOnDark : colors.onDarkMuted} />
                  <Txt v="smallStrong" color={active ? colors.ivory : colors.onDarkMuted} style={{ flex: 1 }}>
                    {n.label}
                  </Txt>
                  {pending[n.href] ? <Badge label={`${pending[n.href]}`} tone="lime" /> : null}
                  {n.href === '/admin/pricing' ? (
                    <Txt v="caption" color={colors.onDarkMuted}>
                      v{pricingVersion}
                    </Txt>
                  ) : null}
                </Row>
              </Tap>
            );
          })}
        </View>
      </View>
      <View style={{ gap: space[4] }}>
        <View style={{ padding: 14, borderRadius: radius.md, backgroundColor: colors.midnight700, gap: 6 }}>
          <Row style={{ gap: 8 }}>
            <LiveDot />
            <Txt v="caption" color={colors.ivory}>
              {country.cityLong} · operación en vivo
            </Txt>
          </Row>
          <Txt v="caption" color={colors.onDarkMuted}>
            Datos reales · {country.currency}
          </Txt>
        </View>
        <Row style={{ gap: 10, paddingHorizontal: space[1] }}>
          <Avatar initials={admin.email ? admin.email[0].toUpperCase() : 'A'} size={36} bg={colors.lime} fg={colors.onLime} />
          <View style={{ flex: 1 }}>
            <Txt v="smallStrong" color={colors.ivory} numberOfLines={1}>
              {admin.email ?? 'Administrador'}
            </Txt>
            <Txt v="caption" color={colors.onDarkMuted}>
              {admin.backend ? 'Administrador' : 'Modo demo · sin backend'}
            </Txt>
          </View>
          {admin.backend ? <IconButton icon={LogOut} label="Cerrar sesión" tone="clearDark" size={34} onPress={admin.signOut} /> : null}
        </Row>
      </View>
    </View>
  );
}

function MobileNav() {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.midnight, paddingTop: insets.top + 8, paddingBottom: 10 }}>
      <Row style={{ paddingHorizontal: space[4], gap: 10, marginBottom: 10 }}>
        <Tap onPress={() => router.navigate('/')} accessibilityLabel="Volver al inicio" hitSlop={12} style={{ minWidth: 32, minHeight: 32, justifyContent: 'center' }}>
          <ArrowLeft size={20} color={colors.ivory} />
        </Tap>
        <Wordmark height={24} color={colors.ivory} />
        <Badge label="Admin" tone="lime" />
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space[4], gap: 6 }}>
        {ADMIN_NAV.map((n) => {
          const active = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
          return (
            <Tap key={n.href} onPress={() => router.navigate(n.href as Href)} accessibilityState={{ selected: active }}>
              <Row style={{ gap: 6, height: 44, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: active ? colors.lime : colors.midnight600 }}>
                <n.icon size={15} color={active ? colors.onLime : colors.onDarkMuted} />
                <Txt v="smallStrong" color={active ? colors.onLime : colors.onDark}>
                  {n.label}
                </Txt>
              </Row>
            </Tap>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Shell() {
  const wide = useWide(1000);
  useStatusTone('light');
  return (
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', backgroundColor: colors.ivory100 }}>
      {wide ? <Sidebar /> : <MobileNav />}
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </View>
  );
}

export default function AdminLayout() {
  return (
    <StatusToneProvider initial="light">
      <Head>
        <title>NÜVA Admin · Consola de operaciones</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <ToastProvider>
        <AdminGate>
          <Shell />
        </AdminGate>
      </ToastProvider>
    </StatusToneProvider>
  );
}
