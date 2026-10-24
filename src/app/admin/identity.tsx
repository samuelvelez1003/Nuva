import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Check, RefreshCw, ScanFace, X } from 'lucide-react-native';
import { Kpi, PageHead, Panel, useWide } from '../../components/admin/AdminKit';
import { Photo, SELFIE_STATUS } from '../../components/admin/IdentityKit';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge, Chip, EmptyState, Row } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { reviewSelfie, SelfieRow, selfieUrls, useAdminSelfies } from '../../lib/adminData';
import { clock, dayLabel, num } from '../../lib/format';
import { useNuvaSettings } from '../../lib/settings';
import { supabase } from '../../lib/supabase';
import { colors, space } from '../../theme/tokens';

interface DriverLite {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  vehicle: { plate?: string } | null;
}

/**
 * Identity check: the selfie each driver takes before going online, next to their
 * profile photo. Rejecting one (not the driver on file) takes them offline until a new one.
 */
export default function IdentityReview() {
  const wide = useWide(1180);
  const toast = useToast();
  const { settings } = useNuvaSettings();
  const [filter, setFilter] = useState<'pendiente' | 'all'>('pendiente');
  const { rows, refresh } = useAdminSelfies();
  const [drivers, setDrivers] = useState<Record<string, DriverLite>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const all = useMemo(() => rows ?? [], [rows]);
  const list = filter === 'all' ? all.slice(0, 60) : all.filter((s) => s.status === 'pendiente');
  const pending = all.filter((s) => s.status === 'pendiente').length;

  // Who took each selfie, and short-lived links to the private images.
  const listKey = list.map((s) => s.id).join(',');
  useEffect(() => {
    if (!supabase || !list.length) return;
    const ids = Array.from(new Set(list.map((s) => s.driver_id))).filter((id) => !drivers[id]);
    if (ids.length) {
      supabase
        .from('profiles')
        .select('id, full_name, email, phone, avatar_url, vehicle')
        .in('id', ids)
        .then(({ data }) => setDrivers((cur) => ({ ...cur, ...Object.fromEntries(((data as DriverLite[]) ?? []).map((d) => [d.id, d])) })));
    }
    const paths = list.map((s) => s.path).filter((p) => !urls[p]);
    if (paths.length) selfieUrls(paths).then((u) => setUrls((cur) => ({ ...cur, ...u })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  const review = async (s: SelfieRow, status: 'aprobada' | 'rechazada') => {
    setBusy(s.id);
    try {
      await reviewSelfie(s.id, status);
      toast(status === 'aprobada' ? 'Selfie aprobada' : 'Selfie rechazada: el conductor quedó desconectado hasta tomarse otra');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'warning');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: wide ? space[10] : space[4], paddingBottom: 120, maxWidth: 1440, width: '100%', alignSelf: 'center' }}>
      <PageHead
        kicker="Seguridad"
        title="Identidad"
        subtitle={
          settings.selfieHours > 0
            ? `Cada conductor se toma una selfie cada ${settings.selfieHours} h antes de recibir viajes. Compárala con su foto de perfil: si no es la misma persona, recházala y queda desconectado.`
            : 'La selfie de verificación está desactivada (Tarifas → Billetera → Selfie de verificación). Aquí siguen las que ya se tomaron.'
        }
        right={<IconButton icon={RefreshCw} label="Actualizar" tone="clear" size={40} onPress={refresh} />}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3], marginBottom: space[5] }}>
        <Kpi accent label="Por revisar" value={num(pending)} icon={ScanFace} />
        <Kpi label="Revisadas (recientes)" value={num(all.length - pending)} />
      </View>
      <Row style={{ gap: 6, marginBottom: space[3], flexWrap: 'wrap' }}>
        <Chip label={`Por revisar (${pending})`} active={filter === 'pendiente'} onPress={() => setFilter('pendiente')} />
        <Chip label="Recientes" active={filter === 'all'} onPress={() => setFilter('all')} />
      </Row>
      {list.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
          {list.map((s) => {
            const d = drivers[s.driver_id];
            const st = SELFIE_STATUS[s.status];
            return (
              <Panel key={s.id} style={{ flexGrow: 1, flexBasis: 360, maxWidth: wide ? 520 : undefined }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyStrong" numberOfLines={1}>
                      {d?.full_name || d?.email || 'Conductor'}
                    </Txt>
                    <Txt v="caption" color={colors.inkMuted} selectable>
                      {[d?.phone, d?.vehicle?.plate].filter(Boolean).join(' · ') || '—'}
                    </Txt>
                    <Txt v="caption" color={colors.inkMuted}>
                      Selfie {dayLabel(new Date(s.created_at))} · {clock(new Date(s.created_at))}
                    </Txt>
                  </View>
                  <Badge label={st.l} tone={st.t} dot />
                </Row>
                <Row style={{ gap: space[4], marginTop: space[4], justifyContent: 'center' }}>
                  <Photo uri={d?.avatar_url} label="Foto de perfil" />
                  <Photo uri={urls[s.path]} label="Selfie" />
                </Row>
                {s.status === 'pendiente' ? (
                  <Row style={{ gap: 8, marginTop: space[4] }}>
                    <Button label="Rechazar" icon={X} variant="outline" size="md" full={false} style={{ flex: 1 }} disabled={busy === s.id} onPress={() => review(s, 'rechazada')} />
                    <Button label="Aprobar" icon={Check} variant="dark" size="md" full={false} style={{ flex: 1 }} loading={busy === s.id} onPress={() => review(s, 'aprobada')} />
                  </Row>
                ) : null}
              </Panel>
            );
          })}
        </View>
      ) : (
        <Panel>
          <EmptyState
            icon={ScanFace}
            title={rows === null ? 'Cargando…' : filter === 'pendiente' ? 'Nada por revisar' : 'Aún no hay selfies'}
            body="Las selfies que los conductores se toman al conectarse aparecerán aquí."
          />
        </Panel>
      )}
    </ScrollView>
  );
}
