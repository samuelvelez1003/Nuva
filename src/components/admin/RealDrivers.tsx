import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import { RefreshCw, UserCheck, UserX } from 'lucide-react-native';
import { Button, IconButton, Tap } from '../ui/Button';
import { Avatar, Badge, EmptyState, Field, Row, Segmented } from '../ui/primitives';
import { useToast } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { cop, dayLabel, moneyCurrency, parseDecimal, toMinor } from '../../lib/format';
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
  vehicle: { brand?: string; model?: string; plate?: string; color?: string; license?: string; insuranceUntil?: string } | null;
  payout: { nequi?: string; bank?: string } | null;
  created_at: string;
  balance?: number;
}

const insuranceExpired = (iso?: string) => !iso || new Date(`${iso}T23:59:59`) < new Date();

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
  // Typed in the country's money ("50" = Cg50,00 or $50), stored in minor units (cents for XCG).
  const cents = moneyCurrency().minorDigits === 2;
  const value = toMinor(parseDecimal(amount));
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
            onChangeText={(t) => setAmount(t.replace(cents ? /[^\d,.]/g : /\D/g, ''))}
            keyboardType={cents ? 'decimal-pad' : 'number-pad'}
            placeholder={cents ? '50,00' : '10000'}
          />
          <Field
            label={sign === 'topup' ? 'Referencia del pago' : 'Motivo'}
            value={reason}
            onChangeText={setReason}
            placeholder={sign === 'topup' ? 'Ej. Transferencia MCB 4471, efectivo en oficina' : 'Ej. Compensación viaje NV-1234'}
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

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, driver_status, vehicle, payout, created_at, country')
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

  // Curaçao drivers need valid insurance: approving with an expired one asks twice.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const setStatus = async (d: DriverRow, status: 'aprobado' | 'suspendido') => {
    if (!supabase) return;
    if (status === 'aprobado' && d.vehicle?.license && insuranceExpired(d.vehicle.insuranceUntil) && confirmId !== d.id) {
      setConfirmId(d.id);
      return toast('El seguro de este conductor está vencido. Toca «Aprobar» otra vez para aprobarlo igual.', 'warning');
    }
    setConfirmId(null);
    setBusy(d.id);
    const { error } = await supabase.rpc('set_driver_status', { p_driver: d.id, p_status: status });
    setBusy(null);
    if (error) return toast(error.message, 'warning');
    toast(
      status === 'aprobado'
        ? `${d.full_name || d.email} aprobado${settings.welcomeBonus > 0 ? ` · bono de ${cop(settings.welcomeBonus)} (si es su primera aprobación)` : ''}`
        : 'Conductor suspendido',
    );
    load();
  };

  return (
    <Panel
      title="Conductores registrados"
      subtitle="Cuentas reales en Supabase. Aprueba para que puedan recibir viajes."
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
                <Avatar initials={(d.full_name || d.email || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()} size={34} />
                <View style={{ flexShrink: 1 }}>
                  <Txt v="smallStrong" numberOfLines={1}>
                    {d.full_name || '—'}
                  </Txt>
                  <Txt v="caption" color={colors.inkMuted} numberOfLines={1}>
                    {d.email} · {d.phone}
                  </Txt>
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
                {/* Curaçao: licence + insurance expiry, flagged when the insurance has expired. */}
                {d.vehicle?.license ? (
                  <Txt v="caption" color={insuranceExpired(d.vehicle.insuranceUntil) ? colors.dangerInk : colors.inkMuted}>
                    Lic. {d.vehicle.license} · seguro {d.vehicle.insuranceUntil ? d.vehicle.insuranceUntil.split('-').reverse().join('/') : '—'}
                    {insuranceExpired(d.vehicle.insuranceUntil) ? ' (vencido)' : ''}
                  </Txt>
                ) : null}
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
          { key: 'status', label: 'Estado', flex: 0.8, render: (d) => <Badge label={STATUS[d.driver_status ?? 'pendiente'].l} tone={STATUS[d.driver_status ?? 'pendiente'].t} dot /> },
          {
            key: 'act',
            label: '',
            width: 140,
            align: 'right',
            render: (d) =>
              d.driver_status === 'aprobado' ? (
                <Button label="Suspender" icon={UserX} variant="outline" size="sm" full={false} loading={busy === d.id} onPress={() => setStatus(d, 'suspendido')} />
              ) : (
                <Button label="Aprobar" icon={UserCheck} variant="dark" size="sm" full={false} loading={busy === d.id} onPress={() => setStatus(d, 'aprobado')} />
              ),
          },
        ]}
      />
      <AdjustModal driver={adjusting} onClose={() => setAdjusting(null)} onDone={load} />
    </Panel>
  );
}
