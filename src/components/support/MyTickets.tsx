import React, { useCallback, useEffect, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MessageSquareReply } from 'lucide-react-native';
import { Badge, Card, Divider, Row, SectionHeader } from '../ui/primitives';
import { Txt } from '../ui/Txt';
import { TKey, useT } from '../../i18n';
import { clock, dayLabel } from '../../lib/format';
import type { TicketKind } from '../../lib/liveTrips';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../store/Auth';
import { colors, radius, space } from '../../theme/tokens';

export interface MyTicket {
  id: string;
  subject: string;
  body: string | null;
  status: 'abierto' | 'en-curso' | 'resuelto';
  kind: TicketKind;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
}

const STATUS: Record<MyTicket['status'], { label: TKey; tone: 'warning' | 'info' | 'success' }> = {
  abierto: { label: 'drv2.tickets.open', tone: 'warning' },
  'en-curso': { label: 'drv2.tickets.inProgress', tone: 'info' },
  resuelto: { label: 'drv2.tickets.resolved', tone: 'success' },
};

const KIND: Partial<Record<TicketKind, TKey>> = {
  apelacion: 'drv2.tickets.kindAppeal',
  seguridad: 'drv2.tickets.kindSafety',
  pago: 'drv2.tickets.kindPayment',
};

const when = (iso: string) => `${dayLabel(new Date(iso))} · ${clock(new Date(iso))}`;

/** The signed-in user's own support cases (RLS: their own rows), newest first. */
export async function fetchMyTickets(userId: string, limit = 20): Promise<MyTicket[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, subject, body, status, kind, reply, replied_at, created_at')
    // Admins can read every case: keep only the user's own.
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data as MyTicket[]) ?? [];
}

/**
 * "My cases": what the user wrote to support, its status and the team's answer
 * (support replies inside the app). Hidden until there's at least one case.
 * `refreshKey` reloads it after opening a new case; it also reloads on focus.
 */
export function MyTickets({ tone = 'light', refreshKey, title, style }: { tone?: 'light' | 'dark'; refreshKey?: unknown; title?: string; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const { live, session } = useAuth();
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const dark = tone === 'dark';
  const uid = session?.user.id;

  const load = useCallback(() => {
    if (!live || !uid) return;
    fetchMyTickets(uid).then(setTickets);
  }, [live, uid]);
  useEffect(load, [load, refreshKey]);
  useFocusEffect(load);

  if (!tickets.length) return null;

  return (
    <View style={style}>
      <SectionHeader tone={tone} title={title ?? t('drv2.tickets.title')} style={{ marginTop: space[6] }} />
      <Card tone={dark ? 'dark' : 'light'} padded={false} style={{ paddingHorizontal: space[4] }}>
        {tickets.map((x, i) => {
          const st = STATUS[x.status] ?? STATUS.abierto;
          const kind = KIND[x.kind];
          return (
            <View key={x.id}>
              {i ? <Divider tone={tone} /> : null}
              <View style={{ paddingVertical: 14, gap: 8 }}>
                <Row style={{ gap: 8, alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyStrong" color={dark ? colors.ivory : colors.ink} numberOfLines={2}>
                      {x.subject}
                    </Txt>
                    <Txt v="caption" color={dark ? colors.onDarkFaint : colors.inkMuted}>
                      {t('drv2.tickets.caseNo', { code: `TK-${x.id.slice(0, 6).toUpperCase()}` })} · {when(x.created_at)}
                    </Txt>
                  </View>
                  <Badge label={t(st.label)} tone={st.tone} />
                </Row>
                {kind ? <Badge label={t(kind)} tone={x.kind === 'pago' ? 'info' : 'danger'} /> : null}
                {x.body ? (
                  <Txt v="small" color={dark ? colors.onDarkMuted : colors.inkSoft} numberOfLines={4}>
                    {x.body}
                  </Txt>
                ) : null}
                {x.reply ? (
                  <View style={{ padding: 12, borderRadius: radius.md, backgroundColor: dark ? colors.limeDim : colors.limeTint, gap: 4 }}>
                    <Row style={{ gap: 6 }}>
                      <MessageSquareReply size={14} color={dark ? colors.lime : colors.limeInk} />
                      <Txt v="smallStrong" color={dark ? colors.lime : colors.limeInk}>
                        {t('drv2.tickets.reply')}
                      </Txt>
                    </Row>
                    <Txt v="small" color={dark ? colors.onDark : colors.ink}>
                      {x.reply}
                    </Txt>
                    {x.replied_at ? (
                      <Txt v="caption" color={dark ? colors.onDarkMuted : colors.inkMuted}>
                        {when(x.replied_at)}
                      </Txt>
                    ) : null}
                  </View>
                ) : x.status !== 'resuelto' ? (
                  <Txt v="caption" color={dark ? colors.onDarkFaint : colors.inkMuted}>
                    {t('drv2.tickets.waiting')}
                  </Txt>
                ) : null}
              </View>
            </View>
          );
        })}
      </Card>
    </View>
  );
}
