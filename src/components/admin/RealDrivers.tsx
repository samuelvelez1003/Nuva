import React, { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, Switch, View } from 'react-native';
import { Check, RefreshCw, UserCheck, UserX, Venus, X } from 'lucide-react-native';
import { Button, IconButton, Tap } from '../ui/Button';
import { Avatar, Badge, EmptyState, Field, Row, Segmented } from '../ui/primitives';
import { useToast } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { fetchDriverSelfies, reviewSelfie, SelfieRow, selfieUrls, setDriverStatus, setWomenVerified } from '../../lib/adminData';
import { clock, cop, dayLabel, moneyCurrency, parseInteger } from '../../lib/format';
import { Photo, SELFIE_STATUS } from './IdentityKit';
import { useNuvaSettings } from '../../lib/settings';
import { activeCountry } from '../../lib/region';
import { supabase } from '../../lib/supabase';
import { colors, radius, space } from '../../theme/tokens';
import { DataTable, Panel } from './AdminKit';

interface DriverRow {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  driver_status: 'pendiente' | 'aprobado' | 'suspendido' | null;
  vehicle: { brand?: string; model?: string; plate?: string; color?: string } | null;
  payout: { nequi?: string } | null;
  created_at: string;
  balance?: number;
  avatar_url?: string | null;
  gender?: 'f' | 'm' | null;
  /** NÜVA Mujeres: checked by the team as a woman driver. */
  women_verified?: boolean;
  women_riders_only?: boolean;
  selfie_at?: string | null;
  /** Why the account is suspended (the driver sees it and can appeal). */
  status_reason?: string | null;
  status_changed_at?: string | null;
}

/** Suspending always carries a reason: the driver sees it in the app and can appeal. */
function SuspendModal({ driver, onClose, onDone }: { driver: DriverRow | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const close = () => {
    setReason('');
    onClose();
  };
  return (
    <Modal visible={!!driver} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: space[4] }}>
        <View style={{ width: '100%', maxWidth: 460, backgroundColor: colors.white, borderRadius: radius.xl, padding: space[6], gap: space[4] }}>
          <View>
            <Txt v="h2">Suspender conductor</Txt>
            <Txt v="body" color={colors.inkMuted} style={{ marginTop: 4 }}>
              {driver?.full_name || driver?.email} queda desconectado y no recibe viajes. Verá el motivo en la app y podrá apelar; la apelación llega a Soporte con prioridad alta.
            </Txt>
          </View>
          <Field label="Motivo (lo ve el conductor)" value={reason} onChangeText={(v) => setReason(v.slice(0, 300))} placeholder="Ej. Tres quejas de pasajeros por conducción peligrosa esta semana" />
          <Row style={{ gap: 10 }}>
            <Button label="Cancelar" variant="outline" size="md" full={false} style={{ flex: 1 }} onPress={close} />
            <Button
              label="Suspender"
              icon={UserX}
              variant="danger"
              size="md"
              full={false}
              style={{ flex: 1 }}
              disabled={reason.trim().length < 5}
              loading={saving}
              onPress={async () => {
                if (!driver) return;
                setSaving(true);
                try {
                  await setDriverStatus(driver.id, 'suspendido', reason);
                  toast('Conductor suspendido');
                  close();
                  onDone();
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'No se pudo suspender', 'warning');
                } finally {
                  setSaving(false);
                }
              }}
            />
          </Row>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Driver file: profile photo next to the latest identity selfies, NÜVA Mujeres and the
 * account status. Mounted per driver (key = id), so its state starts fresh.
 */
function DriverFile({ driver, onClose, onChanged }: { driver: DriverRow; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [selfies, setSelfies] = useState<SelfieRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [women, setWomen] = useState(!!driver.women_verified);

  const id = driver.id;
  const loadSelfies = useCallback(
    () =>
      fetchDriverSelfies(id)
        .then(async (list) => {
          const signed = await selfieUrls(list.map((s) => s.path)).catch(() => ({}));
          setSelfies(list);
          setUrls(signed);
        })
        .catch(() => undefined),
    [id],
  );
  useEffect(() => {
    loadSelfies();
  }, [loadSelfies]);

  const review = async (s: SelfieRow, status: 'aprobada' | 'rechazada') => {
    setBusy(s.id);
    try {
      await reviewSelfie(s.id, status);
      toast(status === 'aprobada' ? 'Selfie aprobada' : 'Selfie rechazada: queda desconectado hasta tomarse otra');
      await loadSelfies();
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'warning');
    } finally {
      setBusy(null);
    }
  };

  const toggleWomen = async (v: boolean) => {
    if (!driver) return;
    setBusy('women');
    try {
      await setWomenVerified(driver.id, v);
      setWomen(v);
      toast(v ? 'Verificada para NÜVA Mujeres' : 'Verificación NÜVA Mujeres retirada');
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'warning');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={!!driver} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: space[4] }}>
        <ScrollView style={{ width: '100%', maxWidth: 620, maxHeight: '92%' }} contentContainerStyle={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: space[6], gap: space[4] }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Txt v="h2">{driver?.full_name || driver?.email || 'Conductor'}</Txt>
              <Txt v="caption" color={colors.inkMuted} selectable>
                {[driver?.email, driver?.phone, driver?.vehicle?.plate].filter(Boolean).join(' · ')}
              </Txt>
            </View>
            <IconButton icon={X} label="Cerrar" tone="clear" size={36} onPress={onClose} />
          </Row>

          {driver?.driver_status === 'suspendido' && driver.status_reason ? (
            <View style={{ padding: 14, borderRadius: radius.md, backgroundColor: colors.dangerSoft, gap: 4 }}>
              <Txt v="smallStrong" color={colors.dangerInk}>
                Suspendido{driver.status_changed_at ? ` · ${dayLabel(new Date(driver.status_changed_at))}` : ''}
              </Txt>
              <Txt v="small" color={colors.dangerInk}>
                {driver.status_reason}
              </Txt>
            </View>
          ) : null}

          <View>
            <Txt v="bodyStrong">Verificación de identidad</Txt>
            <Txt v="caption" color={colors.inkMuted}>
              {driver?.selfie_at ? `Última selfie: ${dayLabel(new Date(driver.selfie_at))} · ${clock(new Date(driver.selfie_at))}` : 'Aún no se ha tomado una selfie.'} Compárala con su foto de perfil.
            </Txt>
          </View>
          <Row style={{ gap: space[3], flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Photo uri={driver?.avatar_url} label="Foto de perfil" size={130} />
            {selfies.map((s) => (
              <View key={s.id} style={{ gap: 6, alignItems: 'center' }}>
                <Photo uri={urls[s.path]} label={`${dayLabel(new Date(s.created_at))} ${clock(new Date(s.created_at))}`} size={130} />
                <Badge label={SELFIE_STATUS[s.status].l} tone={SELFIE_STATUS[s.status].t} dot />
                {s.status === 'pendiente' ? (
                  <Row style={{ gap: 6 }}>
                    <IconButton icon={X} label="Rechazar selfie" tone="light" size={36} onPress={() => review(s, 'rechazada')} />
                    <IconButton icon={Check} label="Aprobar selfie" tone="dark" size={36} onPress={() => review(s, 'aprobada')} />
                  </Row>
                ) : null}
                {busy === s.id ? <Txt v="caption" color={colors.inkMuted}>Guardando…</Txt> : null}
              </View>
            ))}
          </Row>

          <Row style={{ gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineLight }}>
            <Venus size={18} color={colors.ink} />
            <View style={{ flex: 1 }}>
              <Txt v="bodyStrong">NÜVA Mujeres verificada</Txt>
              <Txt v="caption" color={colors.inkMuted}>
                {women
                  ? `Puede tomar viajes de NÜVA Mujeres${driver?.women_riders_only ? ' · eligió solo pasajeras' : ''}.`
                  : 'Verifica con su documento que es mujer: podrá tomar viajes de NÜVA Mujeres y elegir solo pasajeras.'}
              </Txt>
            </View>
            <Switch value={women} disabled={busy === 'women'} onValueChange={toggleWomen} accessibilityLabel="NÜVA Mujeres verificada" />
          </Row>
        </ScrollView>
      </View>
    </Modal>
  );
}

const STATUS = {
  pendiente: { l: 'Por aprobar', t: 'warning' as const },
  aprobado: { l: 'Aprobado', t: 'success' as const },
  suspendido: { l: 'Suspendido', t: 'danger' as const },
};

/** Drivers registered in the real backend, with approve / suspend actions. */
/** Credit or debit a driver's prepaid balance, always with a reason (kept in their movements). */
function AdjustModal({ driver, onClose, onDone }: { driver: DriverRow | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  // topup: money the driver paid in (manual / cash / transfer) — counts as a top-up in
  // finance. credit/debit: corrections, with a reason.
  const [sign, setSign] = useState<'topup' | 'credit' | 'debit'>('topup');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  // Typed in Colombian pesos ("5000" = $5.000).
  const value = parseInteger(amount);
  const signed = sign === 'debit' ? -value : value;
  const valid = value > 0 && value <= 1_000_000 && reason.trim().length >= 3;

  const close = () => {
    setAmount('');
    setReason('');
    setSign('topup');
    onClose();
  };

  return (
    <Modal visible={!!driver} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: space[4] }}>
        <View style={{ width: '100%', maxWidth: 440, backgroundColor: colors.white, borderRadius: radius.xl, padding: space[6], gap: space[4] }}>
          <View>
            <Txt v="h2">Ajustar saldo</Txt>
            <Txt v="body" color={colors.inkMuted} style={{ marginTop: 4 }}>
              {driver?.full_name || driver?.email} · saldo actual {cop(driver?.balance ?? 0)}
            </Txt>
          </View>
          <Segmented
            value={sign}
            onChange={setSign}
            options={[
              { value: 'topup', label: 'Recarga recibida' },
              { value: 'credit', label: 'Abonar' },
              { value: 'debit', label: 'Descontar' },
            ]}
          />
          <Field
            label="Monto"
            prefix={moneyCurrency().symbol}
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder="10000"
          />
          <Field
            label={sign === 'topup' ? 'Referencia del pago' : 'Motivo'}
            value={reason}
            onChangeText={setReason}
            placeholder={sign === 'topup' ? 'Ej. Transferencia Bancolombia 4471, efectivo en oficina' : 'Ej. Compensación viaje NV-1234'}
          />
          {value > 0 ? (
            <Txt v="small" color={colors.inkMuted}>
              Nuevo saldo: <Txt v="smallStrong">{cop((driver?.balance ?? 0) + signed)}</Txt>. El conductor verá el ajuste y el motivo en sus movimientos.
            </Txt>
          ) : null}
          <Row style={{ gap: 10 }}>
            <Button label="Cancelar" variant="outline" size="md" full={false} style={{ flex: 1 }} onPress={close} />
            <Button
              label={sign === 'topup' ? 'Registrar recarga' : sign === 'credit' ? 'Abonar' : 'Descontar'}
              variant="dark"
              size="md"
              full={false}
              style={{ flex: 1 }}
              disabled={!valid}
              loading={saving}
              onPress={async () => {
                if (!supabase || !driver) return;
                setSaving(true);
                const { error } = await supabase.rpc('admin_adjust_wallet', {
                  p_driver: driver.id,
                  p_amount: signed,
                  p_reason: reason.trim(),
                  p_kind: sign === 'topup' ? 'manual' : 'ajuste',
                });
                setSaving(false);
                if (error) return toast(error.message, 'warning');
                toast(sign === 'topup' ? `Recarga registrada: +${cop(signed)}` : `Saldo ajustado: ${signed > 0 ? '+' : '−'}${cop(Math.abs(signed))}`);
                close();
                onDone();
              }}
            />
          </Row>
        </View>
      </View>
    </Modal>
  );
}

export function RealDrivers() {
  const toast = useToast();
  const { settings } = useNuvaSettings();
  const [rows, setRows] = useState<DriverRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<DriverRow | null>(null);
  const [suspending, setSuspending] = useState<DriverRow | null>(null);
  const [file, setFile] = useState<DriverRow | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, driver_status, vehicle, payout, created_at, country, avatar_url, gender, women_verified, women_riders_only, selfie_at, status_reason, status_changed_at')
      .eq('role', 'driver')
      .eq('country', activeCountry())
      .order('created_at', { ascending: false });
    const list = (data as DriverRow[]) ?? [];
    const balances = await Promise.all(list.map((d) => supabase!.rpc('driver_balance', { p_driver: d.id }).then((r) => (r.data as number) ?? 0)));
    setRows(list.map((d, i) => ({ ...d, balance: balances[i] })));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Suspending goes through SuspendModal (a reason is required).
  const approve = async (d: DriverRow) => {
    setBusy(d.id);
    try {
      await setDriverStatus(d.id, 'aprobado');
    } catch (e) {
      setBusy(null);
      return toast(e instanceof Error ? e.message : 'No se pudo aprobar', 'warning');
    }
    setBusy(null);
    toast(`${d.full_name || d.email} aprobado${settings.welcomeBonus > 0 ? ` · bono de ${cop(settings.welcomeBonus)} (si es su primera aprobación)` : ''}`);
    load();
  };

  return (
    <Panel
      title="Conductores registrados"
      subtitle="Cuentas reales en Supabase. Aprueba para que puedan recibir viajes. Toca un conductor para ver su ficha: selfies de identidad y NÜVA Mujeres."
      padded={false}
      style={{ marginBottom: space[6] }}
      right={
        <View style={{ paddingRight: space[5] }}>
          <IconButton icon={RefreshCw} label="Actualizar" tone="clear" size={36} onPress={load} />
        </View>
      }
    >
      <DataTable<DriverRow>
        rows={rows ?? []}
        keyOf={(d) => d.id}
        onRowPress={setFile}
        selectedKey={file?.id}
        empty={
          <EmptyState
            icon={UserCheck}
            title={rows === null ? 'Cargando…' : 'Aún no hay conductores registrados'}
            body="Cuando alguien se registre desde la app de conductor aparecerá aquí para aprobarlo."
          />
        }
        columns={[
          {
            key: 'name',
            label: 'Conductor',
            flex: 1.6,
            render: (d) => (
              <Row style={{ gap: 10 }}>
                <Avatar initials={(d.full_name || d.email || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()} size={34} image={d.avatar_url} />
                <View style={{ flexShrink: 1 }}>
                  <Txt v="smallStrong" numberOfLines={1}>
                    {d.full_name || '—'}
                  </Txt>
                  <Txt v="caption" color={colors.inkMuted} numberOfLines={1}>
                    {d.email} · {d.phone}
                  </Txt>
                  {d.women_verified ? <Badge label="NÜVA Mujeres" tone="success" style={{ marginTop: 4 }} /> : null}
                </View>
              </Row>
            ),
          },
          {
            key: 'vehicle',
            label: 'Vehículo',
            flex: 1.1,
            render: (d) => (
              <View>
                <Txt v="small">{[d.vehicle?.brand, d.vehicle?.model].filter(Boolean).join(' ') || '—'}</Txt>
                <Txt v="caption" color={colors.inkMuted}>
                  {d.vehicle?.plate ?? ''} {d.vehicle?.color ?? ''}
                </Txt>
              </View>
            ),
          },
          { key: 'since', label: 'Registro', flex: 0.7, render: (d) => <Txt v="small" color={colors.inkMuted}>{dayLabel(new Date(d.created_at))}</Txt> },
          {
            key: 'balance',
            label: 'Saldo NÜVA',
            flex: 0.9,
            render: (d) => (
              <Tap haptics={false} onPress={() => setAdjusting(d)} accessibilityLabel={`Ajustar saldo de ${d.full_name || d.email}`}>
                <Txt v="smallStrong" tabular color={(d.balance ?? 0) < settings.lowBalance ? colors.dangerInk : colors.ink}>
                  {cop(d.balance ?? 0)}
                </Txt>
                <Txt v="caption" color={colors.limeInk}>
                  Ajustar
                </Txt>
              </Tap>
            ),
          },
          {
            key: 'status',
            label: 'Estado',
            flex: 1,
            render: (d) => (
              <View style={{ gap: 4 }}>
                <Badge label={STATUS[d.driver_status ?? 'pendiente'].l} tone={STATUS[d.driver_status ?? 'pendiente'].t} dot />
                {/* The reason the driver sees (and can appeal). */}
                {d.driver_status !== 'aprobado' && d.status_reason ? (
                  <Txt v="caption" color={colors.inkMuted} numberOfLines={2}>
                    {d.status_reason}
                  </Txt>
                ) : null}
              </View>
            ),
          },
          {
            key: 'act',
            label: '',
            width: 140,
            align: 'right',
            render: (d) =>
              d.driver_status === 'aprobado' ? (
                <Button label="Suspender" icon={UserX} variant="outline" size="sm" full={false} onPress={() => setSuspending(d)} />
              ) : (
                <Button label="Aprobar" icon={UserCheck} variant="dark" size="sm" full={false} loading={busy === d.id} onPress={() => approve(d)} />
              ),
          },
        ]}
      />
      <AdjustModal driver={adjusting} onClose={() => setAdjusting(null)} onDone={load} />
      <SuspendModal driver={suspending} onClose={() => setSuspending(null)} onDone={load} />
      {file ? <DriverFile key={file.id} driver={file} onClose={() => setFile(null)} onChanged={load} /> : null}
    </Panel>
  );
}
