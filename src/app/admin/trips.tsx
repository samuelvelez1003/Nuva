import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Radar } from 'lucide-react-native';
import { DataTable, Kpi, PageHead, Panel, useWide } from '../../components/admin/AdminKit';
import { CityMap } from '../../components/map/CityMap';
import { CarMarker, PlacePin } from '../../components/map/Markers';
import { Badge, Chip, EmptyState, Row } from '../../components/ui/primitives';
import { Txt } from '../../components/ui/Txt';
import { isLiveActive, useAdminPresence, useAdminTrips } from '../../lib/adminData';
import { clock, cop, dayLabel, decimal, minutes, num } from '../../lib/format';
import { offset, Pt } from '../../lib/geo';
import { estimateRoute, fetchRoute } from '../../lib/routing';
import type { TripRow, TripStatus } from '../../lib/liveTrips';
import { DRIVER_LOCATION } from '../../lib/requests';
import { colors, space } from '../../theme/tokens';

const STATUS: Record<TripStatus, { l: string; t: 'warning' | 'info' | 'lime' | 'success' | 'danger' }> = {
  requested: { l: 'Buscando conductor', t: 'warning' },
  accepted: { l: 'Conductor en camino', t: 'info' },
  arriving: { l: 'En el punto', t: 'info' },
  in_progress: { l: 'En viaje', t: 'lime' },
  completed: { l: 'Completado', t: 'success' },
  cancelled: { l: 'Cancelado', t: 'danger' },
};
const PAY: Record<string, string> = { cash: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', bancolombia: 'Bancolombia', transfer: 'Transferencia', card: 'Tarjeta' };

/** Every trip registered on the server, live. */
export default function TripMonitoring() {
  const wide = useWide(1180);
  const { rows } = useAdminTrips();
  const { rows: presence } = useAdminPresence();
  const [filter, setFilter] = useState<'all' | 'active' | TripStatus>('all');
  const [sel, setSel] = useState<string>();

  const trips = rows ?? [];
  // Requests nobody took in 15 min are dead (drivers stop seeing them): not "active".
  const isActive = isLiveActive;
  const list = trips.filter((t) => (filter === 'all' ? true : filter === 'active' ? isActive(t) : t.status === filter));
  const selected = trips.find((t) => t.id === sel);
  // Street route (OSRM) for the selected trip; the straight estimate only shows while it loads.
  const [streets, setStreets] = useState<{ id: string; points: Pt[] } | null>(null);
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    fetchRoute(selected.pickup, selected.destination).then((r) => alive && setStreets({ id: selected.id, points: r.points }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);
  const route = selected ? (streets?.id === selected.id ? streets.points : estimateRoute(selected.pickup, selected.destination).points) : undefined;

  return (
    <ScrollView contentContainerStyle={{ padding: wide ? space[10] : space[4], paddingBottom: 120, maxWidth: 1440, width: '100%', alignSelf: 'center' }}>
      <PageHead kicker="Operación en vivo" title="Monitoreo de viajes" subtitle="Todos los viajes registrados en el servidor, en tiempo real." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3], marginBottom: space[5] }}>
        <Kpi accent label="Activos ahora" value={num(trips.filter(isActive).length)} icon={Radar} />
        <Kpi label="Buscando conductor" value={num(trips.filter((t) => t.status === 'requested' && isLiveActive(t)).length)} />
        <Kpi label="Completados" value={num(trips.filter((t) => t.status === 'completed').length)} />
        <Kpi label="Conductores en línea" value={num(presence?.length ?? 0)} />
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[5] }}>
        <Panel padded={false} style={{ flex: wide ? 1 : undefined, overflow: 'hidden' }}>
          <View style={{ height: wide ? 520 : 320 }}>
            <CityMap
              theme="dark"
              focus={route ?? [offset(DRIVER_LOCATION, -4500, -4000), offset(DRIVER_LOCATION, 4500, 5200)]}
              insets={{ top: 30, bottom: 30, left: 30, right: 30 }}
              route={route}
              renderMarkers={(toScreen) => (
                <>
                  {(presence ?? [])
                    .filter((p) => p.lat != null && p.lng != null)
                    .map((p) => (
                      <CarMarker key={p.driver_id} pos={toScreen({ lat: p.lat!, lng: p.lng! })} heading={p.heading ?? 0} tone={selected?.driver_id === p.driver_id ? 'lime' : 'muted'} size={selected?.driver_id === p.driver_id ? 34 : 26} />
                    ))}
                  {selected ? (
                    <>
                      <PlacePin pos={toScreen(selected.pickup)} kind="pickup" tone="dark" />
                      <PlacePin pos={toScreen(selected.destination)} kind="dropoff" tone="dark" title={selected.destination.name} route={route?.map(toScreen)} />
                    </>
                  ) : null}
                </>
              )}
            />
          </View>
          {selected ? (
            <View style={{ padding: space[5], gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="title">{selected.code}</Txt>
                <Badge label={STATUS[selected.status].l} tone={STATUS[selected.status].t} dot />
              </Row>
              <Txt v="caption" color={colors.inkMuted}>
                {selected.pickup.name} → {selected.destination.name} · {decimal(Number(selected.distance_km), 1)} km · {minutes(selected.duration_min)} · {PAY[selected.payment] ?? selected.payment} · tarifas v{selected.pricing_version}
              </Txt>
              <Txt v="caption" color={colors.inkMuted}>
                Tarifa {cop(selected.final_fare)} · comisión {cop(selected.platform_commission)} · conductor {cop(selected.driver_earnings)}
              </Txt>
            </View>
          ) : null}
        </Panel>

        <View style={{ flex: wide ? 1.1 : undefined }}>
          <Row style={{ flexWrap: 'wrap', gap: 6, marginBottom: space[3] }}>
            {(['all', 'active', 'completed', 'cancelled'] as const).map((f) => {
              const n = f === 'all' ? trips.length : f === 'active' ? trips.filter(isActive).length : trips.filter((t) => t.status === f).length;
              const label = f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : f === 'completed' ? 'Completados' : 'Cancelados';
              return <Chip key={f} label={`${label} · ${n}`} active={filter === f} onPress={() => setFilter(f)} />;
            })}
          </Row>
          <Panel padded={false}>
            <DataTable<TripRow>
              rows={list}
              keyOf={(t) => t.id}
              selectedKey={sel}
              onRowPress={(t) => setSel(t.id === sel ? undefined : t.id)}
              empty={<EmptyState icon={Radar} title={rows === null ? 'Cargando…' : 'Aún no hay viajes'} body="Los viajes pedidos desde la app aparecerán aquí al instante." />}
              columns={[
                {
                  key: 'id',
                  label: 'Viaje',
                  flex: 1.6,
                  render: (t) => (
                    // minWidth 0 + numberOfLines: long names truncate instead of running under the status badge.
                    <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                      <Txt v="smallStrong" numberOfLines={1}>
                        {t.pickup.name} → {t.destination.name}
                      </Txt>
                      <Txt v="caption" color={colors.inkMuted} numberOfLines={1}>
                        {t.code} · {dayLabel(new Date(t.requested_at))} {clock(new Date(t.requested_at))}
                      </Txt>
                    </View>
                  ),
                },
                { key: 'st', label: 'Estado', width: 176, render: (t) => <Badge label={STATUS[t.status].l} tone={STATUS[t.status].t} dot /> },
                {
                  key: 'fare',
                  label: 'Tarifa',
                  width: 104,
                  align: 'right',
                  // A cancelled trip was never charged: its quoted fare is shown muted and struck through.
                  render: (t) =>
                    t.status === 'cancelled' ? (
                      <Txt v="small" tabular color={colors.inkMuted} style={{ textDecorationLine: 'line-through' }}>
                        {cop(t.final_fare)}
                      </Txt>
                    ) : (
                      <Txt v="smallStrong" tabular>
                        {cop(t.final_fare)}
                      </Txt>
                    ),
                },
                {
                  key: 'com',
                  label: 'Comisión',
                  width: 104,
                  align: 'right',
                  render: (t) =>
                    t.status === 'cancelled' ? (
                      <Txt v="small" color={colors.inkMuted}>—</Txt>
                    ) : (
                      <Txt v="small" tabular color={t.status === 'completed' ? colors.limeInk : colors.inkMuted}>
                        {cop(t.platform_commission)}
                      </Txt>
                    ),
                },
              ]}
            />
          </Panel>
        </View>
      </View>
    </ScrollView>
  );
}
