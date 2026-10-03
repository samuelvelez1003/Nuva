import React, { useEffect, useMemo, useState } from 'react';
import type { TripMessage, TripRow } from '../../lib/liveTrips';
import { ScrollView, View } from 'react-native';
import { CheckCheck, Inbox } from 'lucide-react-native';
import { DataTable, Kpi, PageHead, Panel, useWide } from '../../components/admin/AdminKit';
import { Button } from '../../components/ui/Button';
import { Badge, Chip, Divider, EmptyState, Row } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { TicketRow, useAdminProfiles, useTickets } from '../../lib/adminData';
import { clock, cop, dayLabel, num } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { colors, radius, space } from '../../theme/tokens';

const PRIORITY = { alta: 'danger' as const, media: 'warning' as const, baja: 'neutral' as const };
const STATUS = { abierto: { l: 'Abierto', t: 'warning' as const }, 'en-curso': { l: 'En curso', t: 'info' as const }, resuelto: { l: 'Resuelto', t: 'success' as const } };

/** The trip a ticket is about, with the passenger–driver chat (admins can read it). */
function TicketTrip({ tripId }: { tripId: string }) {
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [messages, setMessages] = useState<TripMessage[]>([]);
  useEffect(() => {
    if (!supabase) return;
    supabase.from('trips').select('*').eq('id', tripId).maybeSingle().then(({ data }) => setTrip((data as TripRow) ?? null));
    supabase.from('trip_messages').select('*').eq('trip_id', tripId).order('created_at').limit(100).then(({ data }) => setMessages((data as TripMessage[]) ?? []));
  }, [tripId]);
  if (!trip) return null;
  return (
    <View style={{ marginTop: space[4], gap: 8 }}>
      <Txt v="smallStrong">
        Viaje {trip.code} · {trip.pickup.name} → {trip.destination.name}
      </Txt>
      <Txt v="caption" color={colors.inkMuted}>
        {dayLabel(new Date(trip.requested_at))} {clock(new Date(trip.requested_at))} · {cop(trip.final_fare)} · estado {trip.status}
      </Txt>
      {messages.length ? (
        <View style={{ gap: 6, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineLight }}>
          <Txt v="caption" color={colors.inkMuted}>
            Chat del viaje
          </Txt>
          {messages.map((m) => (
            <Txt key={m.id} v="small">
              <Txt v="smallStrong">{m.sender_id === trip.passenger_id ? 'Pasajero' : 'Conductor'}:</Txt> {m.body}
            </Txt>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Support tickets created by passengers and drivers (stored on the server). */
export default function SupportTickets() {
  const wide = useWide(1180);
  const toast = useToast();
  const { rows: tickets, refresh } = useTickets();
  const { rows: profiles } = useAdminProfiles();
  const [filter, setFilter] = useState<'all' | TicketRow['status']>('all');
  const [sel, setSel] = useState<string>();

  const who = useMemo(() => new Map((profiles ?? []).map((p) => [p.id, p])), [profiles]);
  const list = (tickets ?? []).filter((t) => filter === 'all' || t.status === filter);
  const t = (tickets ?? []).find((x) => x.id === sel) ?? list[0];

  const setStatus = async (ticket: TicketRow, status: TicketRow['status']) => {
    const { error } = await supabase!.from('support_tickets').update({ status }).eq('id', ticket.id);
    if (error) return toast(error.message, 'warning');
    toast(status === 'resuelto' ? 'Caso resuelto' : 'Caso en curso');
    refresh();
  };

  const open = (tickets ?? []).filter((x) => x.status !== 'resuelto').length;

  return (
    <ScrollView contentContainerStyle={{ padding: wide ? space[10] : space[4], paddingBottom: 120, maxWidth: 1440, width: '100%', alignSelf: 'center' }}>
      <PageHead kicker="Atención" title="Tickets de soporte" subtitle="Casos reales abiertos por pasajeros y conductores." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3], marginBottom: space[5] }}>
        <Kpi accent label="Abiertos" value={num(open)} icon={Inbox} />
        <Kpi label="Resueltos" value={num((tickets ?? []).filter((x) => x.status === 'resuelto').length)} />
        <Kpi label="Total" value={num(tickets?.length ?? 0)} />
      </View>
      <Row style={{ gap: 6, marginBottom: space[3], flexWrap: 'wrap' }}>
        {(['all', 'abierto', 'en-curso', 'resuelto'] as const).map((f) => (
          <Chip key={f} label={f === 'all' ? 'Todos' : STATUS[f].l} active={filter === f} onPress={() => setFilter(f)} />
        ))}
      </Row>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[5], alignItems: 'flex-start' }}>
        <Panel padded={false} style={{ flex: wide ? 1.3 : undefined, width: wide ? undefined : '100%' }}>
          <DataTable<TicketRow>
            rows={list}
            keyOf={(x) => x.id}
            selectedKey={t?.id}
            onRowPress={(x) => setSel(x.id)}
            empty={<EmptyState icon={CheckCheck} title={tickets === null ? 'Cargando…' : 'Bandeja vacía'} body="No hay tickets todavía. Los casos que abran los usuarios aparecerán aquí." />}
            columns={[
              {
                key: 'subject',
                label: 'Caso',
                flex: 2,
                render: (x) => (
                  <View>
                    <Txt v="smallStrong" numberOfLines={1}>
                      {x.subject}
                    </Txt>
                    <Txt v="caption" color={colors.inkMuted}>
                      {who.get(x.created_by)?.full_name || who.get(x.created_by)?.email || 'Usuario'} · {dayLabel(new Date(x.created_at))}
                    </Txt>
                  </View>
                ),
              },
              { key: 'p', label: 'Prioridad', flex: 0.7, render: (x) => <Badge label={x.priority[0].toUpperCase() + x.priority.slice(1)} tone={PRIORITY[x.priority]} /> },
              { key: 's', label: 'Estado', flex: 0.8, render: (x) => <Badge label={STATUS[x.status].l} tone={STATUS[x.status].t} dot /> },
            ]}
          />
        </Panel>

        {t ? (
          <Panel style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%' }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="caption" color={colors.inkMuted}>
                {dayLabel(new Date(t.created_at))} · {clock(new Date(t.created_at))}
              </Txt>
              <Badge label={STATUS[t.status].l} tone={STATUS[t.status].t} dot />
            </Row>
            <Txt v="h3" style={{ marginTop: 8 }}>
              {t.subject}
            </Txt>
            {/* Who opened it and how to reach them (there's no in-app reply yet). */}
            <Txt v="caption" color={colors.inkMuted} selectable>
              {[
                who.get(t.created_by)?.full_name,
                who.get(t.created_by)?.role === 'driver' ? 'Conductor' : who.get(t.created_by)?.role === 'admin' ? 'Admin' : 'Pasajero',
                who.get(t.created_by)?.email,
                who.get(t.created_by)?.phone,
              ]
                .filter(Boolean)
                .join(' · ') || 'Usuario'}
            </Txt>
            <Divider style={{ marginVertical: space[4] }} />
            <View style={{ padding: 14, borderRadius: radius.md, backgroundColor: colors.ivory100 }}>
              <Txt v="small" color={colors.inkSoft}>
                {t.body || 'Sin descripción.'}
              </Txt>
            </View>
            {t.trip_id ? <TicketTrip tripId={t.trip_id} /> : null}
            <Row style={{ gap: 8, marginTop: space[4] }}>
              {t.status === 'abierto' ? <Button label="Tomar caso" variant="outline" size="md" full={false} onPress={() => setStatus(t, 'en-curso')} /> : null}
              {t.status !== 'resuelto' ? <Button label="Marcar resuelto" icon={CheckCheck} variant="dark" size="md" full={false} onPress={() => setStatus(t, 'resuelto')} /> : null}
            </Row>
          </Panel>
        ) : null}
      </View>
    </ScrollView>
  );
}
