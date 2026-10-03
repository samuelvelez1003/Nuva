import React, { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Search, Users } from 'lucide-react-native';
import { DataTable, Kpi, PageHead, Panel, useWide } from '../../components/admin/AdminKit';
import { Avatar, EmptyState, Row } from '../../components/ui/primitives';
import { Txt } from '../../components/ui/Txt';
import { AdminProfile, useAdminProfiles, useAdminTrips } from '../../lib/adminData';
import { cop, dayLabel, num } from '../../lib/format';
import { colors, fonts, radius, space } from '../../theme/tokens';

interface PassengerRow extends AdminProfile {
  trips: number;
  spent: number;
  last?: string;
}

/** Passengers registered on the server, with their real trip activity. */
export default function PassengerManagement() {
  const wide = useWide(1180);
  const { rows: profiles } = useAdminProfiles();
  const { rows: trips } = useAdminTrips();
  const [q, setQ] = useState('');

  const rows: PassengerRow[] = useMemo(() => {
    const byUser = new Map<string, { trips: number; spent: number; last?: string }>();
    for (const t of trips ?? []) {
      if (t.status !== 'completed') continue;
      const s = byUser.get(t.passenger_id) ?? { trips: 0, spent: 0 };
      s.trips += 1;
      s.spent += t.final_fare;
      s.last = s.last && s.last > t.requested_at ? s.last : t.requested_at;
      byUser.set(t.passenger_id, s);
    }
    const n = q.trim().toLowerCase();
    return (profiles ?? [])
      .filter((p) => p.role === 'passenger')
      .filter((p) => !n || `${p.full_name} ${p.email} ${p.phone}`.toLowerCase().includes(n))
      .map((p) => ({ ...p, trips: 0, spent: 0, ...byUser.get(p.id) }));
  }, [profiles, trips, q]);

  const total = (profiles ?? []).filter((p) => p.role === 'passenger').length;
  const active = rows.filter((r) => r.trips > 0).length;
  const spent = rows.reduce((a, r) => a + r.spent, 0);

  return (
    <ScrollView contentContainerStyle={{ padding: wide ? space[10] : space[4], paddingBottom: 120, maxWidth: 1440, width: '100%', alignSelf: 'center' }}>
      <PageHead kicker="Gestión" title="Pasajeros" subtitle="Cuentas reales registradas desde la app." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3], marginBottom: space[5] }}>
        <Kpi accent label="Pasajeros registrados" value={num(total)} icon={Users} />
        <Kpi label="Con al menos un viaje" value={num(active)} />
        <Kpi label="Gasto total en viajes" value={cop(spent)} />
      </View>
      <Row style={{ height: 46, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineLight, paddingHorizontal: 16, gap: 10, marginBottom: space[4] }}>
        <Search size={17} color={colors.inkMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar por nombre, correo o celular"
          placeholderTextColor={colors.stone}
          accessibilityLabel="Buscar pasajeros"
          style={[{ flex: 1, minWidth: 0, width: 10, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }, { outlineStyle: 'none' } as object]}
        />
      </Row>
      <Panel padded={false}>
        <DataTable<PassengerRow>
          rows={rows}
          keyOf={(p) => p.id}
          empty={<EmptyState icon={Users} title={profiles === null ? 'Cargando…' : 'Aún no hay pasajeros'} body="Cuando alguien cree su cuenta en la app aparecerá aquí." />}
          columns={[
            {
              key: 'name',
              label: 'Pasajero',
              flex: 1.6,
              render: (p) => (
                <Row style={{ gap: 10 }}>
                  <Avatar initials={(p.full_name || p.email || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()} size={34} />
                  <View style={{ flexShrink: 1 }}>
                    <Txt v="smallStrong" numberOfLines={1}>
                      {p.full_name || '—'}
                    </Txt>
                    <Txt v="caption" color={colors.inkMuted} numberOfLines={1}>
                      {p.email} · {p.phone}
                    </Txt>
                  </View>
                </Row>
              ),
            },
            { key: 'trips', label: 'Viajes', flex: 0.6, render: (p) => <Txt v="small" tabular>{num(p.trips)}</Txt> },
            { key: 'spent', label: 'Gastado', flex: 0.8, render: (p) => <Txt v="smallStrong" tabular>{cop(p.spent)}</Txt> },
            { key: 'last', label: 'Último viaje', flex: 0.8, render: (p) => <Txt v="small" color={colors.inkMuted}>{p.last ? dayLabel(new Date(p.last)) : '—'}</Txt> },
            { key: 'since', label: 'Registro', flex: 0.8, render: (p) => <Txt v="small" color={colors.inkMuted}>{dayLabel(new Date(p.created_at))}</Txt> },
          ]}
        />
      </Panel>
    </ScrollView>
  );
}
