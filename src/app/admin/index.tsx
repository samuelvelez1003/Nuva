import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { activeCountry } from '../../lib/region';
import { useCountry } from '../../lib/country';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ban, Banknote, Car, CheckCircle2, Coins, Radar, Receipt, Route, SlidersHorizontal, Users } from 'lucide-react-native';
import { DataTable, Kpi, PageHead, Panel, useWide } from '../../components/admin/AdminKit';
import { AreaChart, BarChart } from '../../components/charts/Charts';
import { CityMap } from '../../components/map/CityMap';
import { CarMarker } from '../../components/map/Markers';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState, LiveDot, Row, Segmented } from '../../components/ui/primitives';
import { Txt } from '../../components/ui/Txt';
import { ACTIVE_STATUSES, dailyTotals, monthlyTotals, useAdminPresence, useAdminProfiles, useAdminTrips } from '../../lib/adminData';
import { cop, copCompact, decimal, monthShort, num, pct } from '../../lib/format';
import { offset } from '../../lib/geo';
import { greeting } from '../../lib/hooks';
import { DRIVER_LOCATION } from '../../lib/requests';
import { useApp } from '../../store/AppStore';
import { colors, radius, space } from '../../theme/tokens';

const STATUS_LABEL: Record<string, { l: string; t: 'warning' | 'info' | 'lime' | 'success' | 'danger' }> = {
  requested: { l: 'Buscando conductor', t: 'warning' },
  accepted: { l: 'Conductor en camino', t: 'info' },
  arriving: { l: 'En el punto', t: 'info' },
  in_progress: { l: 'En viaje', t: 'lime' },
};

interface Finance {
  topups: number;
  topupsCount: number;
  bonuses: number;
  adjustments: number;
  commissions: number;
  balances: number;
  lowDrivers: number;
}

/**
 * The real money (last 30 days). Commission "earned" is not cash: NÜVA's cash is
 * what drivers top up through Wompi; commissions are then consumed from that balance.
 */
function MoneyPanel() {
  const [f, setF] = useState<Finance | null>(null);
  const { country } = useCountry();
  const manual = country.topup === 'manual';
  useEffect(() => {
    supabase?.rpc('admin_finance', { p_days: 30, p_country: activeCountry() }).then(({ data }) => data && setF(data as Finance));
  }, []);
  if (!f) return null;
  const items = [
    { l: manual ? 'Recargas recibidas (manuales)' : 'Recargas recibidas (Wompi)', v: cop(f.topups), h: `${num(f.topupsCount)} ${f.topupsCount === 1 ? 'recarga' : 'recargas'} · dinero que entró a NÜVA` },
    { l: 'Comisión cobrada', v: cop(f.commissions), h: 'descontada del saldo de conductores' },
    { l: 'Bonos y ajustes', v: cop(f.bonuses + f.adjustments), h: `bonos ${cop(f.bonuses)} · ajustes ${cop(f.adjustments)}` },
    { l: 'Saldo en billeteras', v: cop(f.balances), h: f.lowDrivers ? `${num(f.lowDrivers)} conductor${f.lowDrivers > 1 ? 'es' : ''} con saldo bajo` : 'prepago pendiente por consumir' },
  ];
  return (
    <Panel style={{ marginTop: space[5] }} title="Dinero real · 30 días" subtitle="Los pasajeros pagan directo al conductor. NÜVA recibe dinero solo por las recargas de saldo; la comisión se consume de ese saldo.">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
        {items.map((it) => (
          <View key={it.l} style={{ flexGrow: 1, flexBasis: 220, padding: space[4], borderRadius: radius.lg, backgroundColor: colors.ivory100, gap: 4 }}>
            <Txt v="caption" color={colors.inkMuted}>
              {it.l}
            </Txt>
            <Txt v="h2" tabular>
              {it.v}
            </Txt>
            <Txt v="caption" color={it.l.startsWith('Saldo') && f.lowDrivers ? colors.dangerInk : colors.inkMuted}>
              {it.h}
            </Txt>
          </View>
        ))}
      </View>
    </Panel>
  );
}

/** Real-time overview from Supabase. Every figure is computed from real trips. */
export default function AdminOverview() {
  const wide = useWide(1180);
  const { pricingVersion } = useApp();
  const { country } = useCountry();
  const [chart, setChart] = useState<'commission' | 'volume'>('commission');
  const { rows: trips } = useAdminTrips();
  const { rows: profiles } = useAdminProfiles();
  const { rows: presence } = useAdminPresence();

  const all = trips ?? [];
  const daily = useMemo(() => dailyTotals(all, 30), [all]);
  const monthly = useMemo(() => monthlyTotals(all, 12), [all]);
  const completed = all.filter((t) => t.status === 'completed');
  const cancelled = all.filter((t) => t.status === 'cancelled');
  const active = all.filter((t) => (ACTIVE_STATUSES as readonly string[]).includes(t.status));
  const volume = completed.reduce((a, t) => a + t.final_fare, 0);
  const commission = completed.reduce((a, t) => a + t.platform_commission, 0);
  const avg = completed.length ? Math.round(volume / completed.length) : 0;
  const todayStr = new Date().toDateString();
  const today = completed.filter((t) => new Date(t.completed_at ?? t.requested_at).toDateString() === todayStr).length;
  const drivers = (profiles ?? []).filter((p) => p.role === 'driver');
  const approved = drivers.filter((d) => d.driver_status === 'aprobado').length;
  const pending = drivers.filter((d) => d.driver_status === 'pendiente').length;
  const passengers = (profiles ?? []).filter((p) => p.role === 'passenger').length;
  const last15 = daily.slice(-15);
  const hasData = all.length > 0;

  return (
    <ScrollView contentContainerStyle={{ padding: wide ? space[10] : space[4], paddingBottom: 120, maxWidth: 1440, width: '100%', alignSelf: 'center' }}>
      <PageHead
        kicker={`${country.name} · operación en vivo`}
        title={greeting()}
        subtitle={`Cifras de ${country.name} en ${country.currencyName.toLowerCase()} (${country.currency}), calculadas de los viajes reales. Se actualizan solas.`}
        right={
          <>
            <Row style={{ gap: 8, paddingHorizontal: 14, height: 40, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineLight }}>
              <LiveDot color={colors.midnight} />
              <Txt v="smallStrong">
                {num(active.length)} {active.length === 1 ? 'viaje activo' : 'viajes activos'}
              </Txt>
            </Row>
            <Button label={`Tarifas ${country.name} · v${pricingVersion}`} icon={SlidersHorizontal} variant="dark" size="md" full={false} onPress={() => router.navigate('/admin/pricing')} />
          </>
        }
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
        <Kpi accent label="Comisión NÜVA" value={cop(commission)} icon={Coins} hint="viajes completados" />
        <Kpi label="Volumen transaccionado" value={cop(volume)} icon={Banknote} hint="pagado por pasajeros" />
        <Kpi label="Viajes completados" value={num(completed.length)} icon={Route} hint={`${num(today)} hoy`} />
        <Kpi label="Tarifa promedio" value={avg ? cop(avg) : '—'} icon={Receipt} hint={avg ? 'por viaje completado' : 'sin viajes completados'} />
        <Kpi label="Cancelaciones" value={all.length ? pct((cancelled.length / all.length) * 100, 1) : '—'} icon={Ban} hint={all.length ? `${num(cancelled.length)} de ${num(all.length)} viajes` : 'sin viajes aún'} />
        <Kpi label="Conductores aprobados" value={num(approved)} icon={Car} hint={pending ? `${pending} por aprobar` : `${num(drivers.length)} registrados`} />
        <Kpi label="Pasajeros registrados" value={num(passengers)} icon={Users} hint={`cuentas en ${country.name}`} />
        <Kpi label="Conectados ahora" value={num(presence?.length ?? 0)} icon={CheckCircle2} hint="conductores en línea" />
      </View>

      <MoneyPanel />

      {!hasData && trips !== null ? (
        <Panel style={{ marginTop: space[5] }}>
          <EmptyState
            icon={Radar}
            title="Aún no hay viajes"
            body="Cuando un pasajero pida su primer viaje desde la app, verás aquí los ingresos, la comisión y el mapa en vivo."
            action={pending ? <Button label={`Aprobar ${pending} conductor${pending > 1 ? 'es' : ''}`} variant="dark" size="md" onPress={() => router.navigate('/admin/drivers')} /> : undefined}
          />
        </Panel>
      ) : null}

      {/* Charts only once there is something to plot; empty they'd be flat lines at zero. */}
      {hasData ? (
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[5], marginTop: space[5] }}>
        <Panel
          style={{ flex: wide ? 1.6 : undefined }}
          title="Ingresos diarios"
          subtitle="Últimos 15 días"
          right={
            <Segmented
              value={chart}
              onChange={setChart}
              style={{ width: 240 }}
              options={[
                { value: 'commission', label: 'Comisión' },
                { value: 'volume', label: 'Volumen' },
              ]}
            />
          }
        >
          <Txt v="h1" tabular>
            {cop(last15.reduce((a, d) => a + d[chart], 0))}
          </Txt>
          <View style={{ marginTop: space[4] }}>
            <AreaChart values={last15.map((d) => d[chart])} height={200} labels={[last15[0], last15[7], last15[14]].map((d) => `${d.date.getDate()} ${monthShort(d.date.getMonth())}`)} />
          </View>
        </Panel>
        <Panel style={{ flex: wide ? 1 : undefined }} title="Comisión mensual" subtitle="12 meses">
          <Txt v="h1" tabular>
            {cop(monthly[monthly.length - 1].commission)}
            <Txt v="body" color={colors.inkMuted}>
              {'  '}este mes
            </Txt>
          </Txt>
          <View style={{ marginTop: space[4] }}>
            <BarChart tone="light" height={170} format={copCompact} data={monthly.map((m, i) => ({ label: monthShort(m.month), value: m.commission, highlight: i === monthly.length - 1 }))} />
          </View>
        </Panel>
      </View>
      ) : null}

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[5], marginTop: space[5] }}>
        <Panel style={{ flex: wide ? 1 : undefined }} title="Conductores en línea" subtitle="Posición reportada por la app" padded={false} right={<View style={{ paddingRight: space[5] }}><Badge label={`${presence?.length ?? 0} en línea`} tone="lime" dot /></View>}>
          <View style={{ height: 340, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, overflow: 'hidden' }}>
            <CityMap
              theme="dark"
              focus={[offset(DRIVER_LOCATION, -3500, -3500), offset(DRIVER_LOCATION, 3500, 3500)]}
              insets={{ top: 10, bottom: 10, left: 10, right: 10 }}
              renderMarkers={(toScreen) =>
                (presence ?? [])
                  .filter((p) => p.lat != null && p.lng != null)
                  .map((p) => <CarMarker key={p.driver_id} pos={toScreen({ lat: p.lat!, lng: p.lng! })} heading={p.heading ?? 0} tone="lime" size={28} />)
              }
            />
          </View>
        </Panel>
        <Panel style={{ flex: wide ? 1.2 : undefined }} title="Viajes activos" subtitle="Tarifa calculada por el servidor" padded={false} right={<View style={{ paddingRight: space[5] }}><Button label="Ver todos" variant="outline" size="sm" full={false} onPress={() => router.navigate('/admin/trips')} /></View>}>
          <DataTable
            rows={active.slice(0, 8)}
            keyOf={(t) => t.id}
            empty={<EmptyState icon={Route} title="Sin viajes activos" body="Los viajes en curso aparecerán aquí en tiempo real." />}
            columns={[
              {
                key: 'route',
                label: 'Ruta',
                flex: 1.6,
                render: (t) => (
                  <View>
                    <Txt v="smallStrong" numberOfLines={1}>
                      {t.pickup.name} → {t.destination.name}
                    </Txt>
                    <Txt v="caption" color={colors.inkMuted}>
                      {t.code} · {decimal(Number(t.distance_km), 1)} km
                    </Txt>
                  </View>
                ),
              },
              { key: 'st', label: 'Estado', flex: 1.1, render: (t) => <Badge label={STATUS_LABEL[t.status]?.l ?? t.status} tone={STATUS_LABEL[t.status]?.t ?? 'neutral'} dot /> },
              { key: 'fare', label: 'Tarifa', align: 'right', render: (t) => <Txt v="smallStrong" tabular>{cop(t.final_fare)}</Txt> },
              { key: 'com', label: 'Comisión', align: 'right', render: (t) => <Txt v="small" tabular color={colors.limeInk}>{cop(t.platform_commission)}</Txt> },
            ]}
          />
        </Panel>
      </View>
    </ScrollView>
  );
}
