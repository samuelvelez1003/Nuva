import React from 'react';
import { ScrollView, View } from 'react-native';
import { Href, router, Slot, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Car,
  Headset,
  Landmark,
  LayoutDashboard,
  LogOut,
  Map,
  Megaphone,
  Radar,
  SlidersHorizontal,
  Users,
} from 'lucide-react-native';
import { useWide } from '../../components/admin/AdminKit';
import { AdminGate, useAdminSession } from '../../components/admin/AdminGate';
import { IconButton } from '../../components/ui/Button';
import { Wordmark } from '../../components/brand/Brand';
import { Tap } from '../../components/ui/Button';
import { Avatar, Badge, LiveDot, Row } from '../../components/ui/primitives';
import { StatusToneProvider, ToastProvider, useStatusTone, useToast } from '../../components/ui/Screen';
import { hasUnsaved } from '../../lib/region';
import { Txt } from '../../components/ui/Txt';
import { useTickets } from '../../lib/adminData';
import { Flag } from '../../components/brand/Flags';
import { COUNTRIES, COUNTRY_ORDER } from '../../lib/countries';
import { useCountry } from '../../lib/country';
import { useApp } from '../../store/AppStore';
import { colors, radius, space } from '../../theme/tokens';

const ADMIN_NAV = [
  { href: '/admin', label: 'Resumen', icon: LayoutDashboard },
  { href: '/admin/pricing', label: 'Tarifas y comisión', icon: SlidersHorizontal },
  { href: '/admin/trips', label: 'Monitoreo de viajes', icon: Radar },
  { href: '/admin/drivers', label: 'Conductores', icon: Car },
  { href: '/admin/passengers', label: 'Pasajeros', icon: Users },
  { href: '/admin/zones', label: 'Zonas de servicio', icon: Map },
  { href: '/admin/promos', label: 'Promociones', icon: Megaphone },
  { href: '/admin/banks', label: 'Cuentas bancarias', icon: Landmark },
  { href: '/admin/support', label: 'Soporte', icon: Headset },
];

/** Country the console is operating: every page (data, rates, zones, wallet rules) follows it. */
function CountrySwitch() {
  const { code, setCountry } = useCountry();
  const toast = useToast();
  // Switching remounts everything: with unsaved edits, the first tap only warns.
  const [armed, setArmed] = React.useState<string | null>(null);
  const choose = (c: typeof code) => {
    if (c === code) return;
    if (hasUnsaved() && armed !== c) {
      setArmed(c);
      toast(`Tienes cambios sin publicar. Toca ${COUNTRIES[c].name} otra vez para cambiar y descartarlos.`, 'warning');
      return;
    }
    setArmed(null);
    setCountry(c);
  };
  return (
    <Row style={{ gap: 6, padding: 4, borderRadius: radius.pill, backgroundColor: colors.midnight700 }}>
      {COUNTRY_ORDER.map((c) => {
        const active = c === code;
        return (
          <Tap
            key={c}
            haptics={false}
            onPress={() => choose(c)}
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Operar ${COUNTRIES[c].name}`}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 36, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: active ? colors.lime : 'transparent' }}
          >
            <View style={{ borderRadius: 2, overflow: 'hidden' }}>
              <Flag code={c} width={20} radius={2} />
            </View>
            <Txt v="smallStrong" color={active ? colors.midnight : colors.onDarkMuted}>
              {COUNTRIES[c].name}
            </Txt>
          </Tap>
        );
      })}
    </Row>
  );
}

function Sidebar() {
  const { country } = useCountry();
  const path = usePathname();
  const { pricingVersion } = useApp();
  const admin = useAdminSession();
  const { rows: tickets } = useTickets();
  const open = (tickets ?? []).filter((t) => t.status !== 'resuelto').length;
  return (
    <View style={{ width: 256, backgroundColor: colors.midnight, paddingVertical: space[6], paddingHorizontal: space[4], justifyContent: 'space-between' }}>
      <View>
        <Row style={{ gap: 10, paddingHorizontal: space[2] }}>
          <Tap haptics={false} onPress={() => router.navigate('/')} accessibilityLabel="Inicio">
            <Wordmark height={24} color={colors.ivory} />
          </Tap>
          <Badge label="Admin" tone="lime" />
        </Row>
        <View style={{ marginTop: space[6] }}>
          <CountrySwitch />
        </View>
        <View style={{ marginTop: space[6], gap: 2 }}>
          {ADMIN_NAV.map((n) => {
            const active = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
            return (
              <Tap key={n.href} haptics={false} scaleTo={0.98} onPress={() => router.navigate(n.href as Href)} accessibilityState={{ selected: active }}>
                <Row style={{ gap: 12, height: 44, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: active ? colors.midnight600 : 'transparent' }}>
                  <n.icon size={18} color={active ? colors.lime : colors.onDarkMuted} />
                  <Txt v="smallStrong" color={active ? colors.ivory : colors.onDarkMuted} style={{ flex: 1 }}>
                    {n.label}
                  </Txt>
                  {n.href === '/admin/support' && open ? <Badge label={`${open}`} tone="lime" /> : null}
                  {n.href === '/admin/pricing' ? (
                    <Txt v="caption" color={colors.onDarkFaint}>
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
          <Txt v="caption" color={colors.onDarkFaint}>
            Datos reales · {country.currency}
          </Txt>
        </View>
        <Row style={{ gap: 10, paddingHorizontal: space[1] }}>
          <Avatar initials={admin.email ? admin.email[0].toUpperCase() : 'A'} size={36} bg={colors.lime} fg={colors.midnight} />
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
        <Tap onPress={() => router.navigate('/')} accessibilityLabel="Volver al inicio">
          <ArrowLeft size={20} color={colors.ivory} />
        </Tap>
        <Wordmark height={18} color={colors.ivory} />
        <Badge label="Admin" tone="lime" />
      </Row>
      <View style={{ paddingHorizontal: space[4], marginBottom: 10 }}>
        <CountrySwitch />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space[4], gap: 6 }}>
        {ADMIN_NAV.map((n) => {
          const active = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
          return (
            <Tap key={n.href} onPress={() => router.navigate(n.href as Href)} accessibilityState={{ selected: active }}>
              <Row style={{ gap: 6, height: 36, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: active ? colors.lime : colors.midnight600 }}>
                <n.icon size={15} color={active ? colors.midnight : colors.onDarkMuted} />
                <Txt v="smallStrong" color={active ? colors.midnight : colors.onDark}>
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
