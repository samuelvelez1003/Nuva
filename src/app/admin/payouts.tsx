import React, { useState } from 'react';
import { Modal, Platform, ScrollView, View } from 'react-native';
import { Banknote, CheckCheck, Copy, HandCoins, RefreshCw, X } from 'lucide-react-native';
import { DataTable, Kpi, PageHead, Panel, useWide } from '../../components/admin/AdminKit';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge, Chip, EmptyState, Field, Row } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { resolveWithdrawal, useAdminWithdrawals, WithdrawalRow } from '../../lib/adminData';
import { clock, cop, dayLabel, num } from '../../lib/format';
import { useNuvaSettings } from '../../lib/settings';
import { colors, radius, space } from '../../theme/tokens';

const METHOD: Record<string, string> = { nequi: 'Nequi', daviplata: 'Daviplata', bancolombia: 'Bancolombia', banco: 'Otro banco' };
const STATUS = {
  procesando: { l: 'Por pagar', t: 'warning' as const },
  completado: { l: 'Pagado', t: 'success' as const },
  rechazado: { l: 'Rechazado', t: 'danger' as const },
};

/** The browser's clipboard (the console runs on the web; native shows the text selectable). */
const canCopy = Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.clipboard;

function CopyText({ text }: { text: string }) {
  const toast = useToast();
  return (
    <Row style={{ gap: 4 }}>
      <Txt v="smallStrong" tabular selectable>
        {text}
      </Txt>
      {canCopy ? (
        <IconButton
          icon={Copy}
          label={`Copiar ${text}`}
          tone="clear"
          size={30}
          onPress={() =>
            navigator.clipboard
              .writeText(text)
              .then(() => toast('Copiado'))
              .catch(() => toast('No se pudo copiar', 'warning'))
          }
        />
      ) : null}
    </Row>
  );
}

/** Mark paid (optional transfer reference) or reject (reason required: the driver sees it). */
function ResolveModal({ row, action, onClose, onDone }: { row: WithdrawalRow | null; action: 'completado' | 'rechazado'; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const reject = action === 'rechazado';
  const valid = !reject || note.trim().length >= 3;
  const close = () => {
    setNote('');
    onClose();
  };
  return (
    <Modal visible={!!row} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: space[4] }}>
        <View style={{ width: '100%', maxWidth: 460, backgroundColor: colors.white, borderRadius: radius.xl, padding: space[6], gap: space[4] }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="h2">{reject ? 'Rechazar retiro' : 'Marcar como pagado'}</Txt>
            <IconButton icon={X} label="Cerrar" tone="clear" size={36} onPress={close} />
          </Row>
          {row ? (
            <View style={{ padding: 14, borderRadius: radius.md, backgroundColor: colors.ivory100, gap: 4 }}>
              <Txt v="bodyStrong">
                {row.driver || 'Conductor'} · {cop(row.amount)}
              </Txt>
              <Txt v="small" color={colors.inkSoft}>
                {METHOD[row.method ?? ''] ?? row.method ?? '—'} · {row.account ?? '—'}
              </Txt>
            </View>
          ) : null}
          <Field
            label={reject ? 'Motivo del rechazo (lo ve el conductor)' : 'Referencia del pago (opcional)'}
            value={note}
            onChangeText={(v) => setNote(v.slice(0, 200))}
            placeholder={reject ? 'Ej. La cuenta Nequi no está a su nombre' : 'Ej. Transferencia Nequi M123456'}
          />
          <Txt v="caption" color={colors.inkMuted}>
            {reject
              ? 'El dinero vuelve a quedar disponible en su saldo y puede pedir otro retiro.'
              : 'Marca el retiro como pagado solo después de enviar el dinero. El conductor lo verá en sus movimientos.'}
          </Txt>
          <Row style={{ gap: 10 }}>
            <Button label="Cancelar" variant="outline" size="md" full={false} style={{ flex: 1 }} onPress={close} />
            <Button
              label={reject ? 'Rechazar' : 'Marcar pagado'}
              icon={reject ? X : CheckCheck}
              variant={reject ? 'danger' : 'dark'}
              size="md"
              full={false}
              style={{ flex: 1 }}
              disabled={!valid}
              loading={saving}
              onPress={async () => {
                if (!row) return;
                setSaving(true);
                try {
                  await resolveWithdrawal(row.id, action, note);
                  toast(reject ? 'Retiro rechazado' : `Retiro de ${cop(row.amount)} marcado como pagado`);
                  close();
                  onDone();
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'No se pudo guardar', 'warning');
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
 * Drivers' withdrawals: what NÜVA collected for them (card trips, cancellation fees,
 * promotions). The team sends the money by hand and marks it here.
 */
export default function Payouts() {
  const wide = useWide(1180);
  const { settings } = useNuvaSettings();
  const { rows, refresh } = useAdminWithdrawals();
  const [filter, setFilter] = useState<'procesando' | 'all'>('procesando');
  const [resolving, setResolving] = useState<{ row: WithdrawalRow; action: 'completado' | 'rechazado' } | null>(null);

  const all = rows ?? [];
  const list = filter === 'all' ? all : all.filter((w) => w.status === 'procesando');
  const pending = all.filter((w) => w.status === 'procesando');
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const paidMonth = all.filter((w) => w.status === 'completado' && new Date(w.processedAt ?? w.createdAt).getTime() >= monthStart);

  return (
    <ScrollView contentContainerStyle={{ padding: wide ? space[10] : space[4], paddingBottom: 120, maxWidth: 1440, width: '100%', alignSelf: 'center' }}>
      <PageHead
        kicker="Finanzas"
        title="Retiros"
        subtitle={`Los conductores retiran lo que NÜVA cobró por ellos (viajes con tarjeta, compensaciones, promociones). Envía el dinero el mismo día hábil y márcalo pagado. Retiro mínimo: ${cop(settings.minWithdrawal)}.`}
        right={<IconButton icon={RefreshCw} label="Actualizar" tone="clear" size={40} onPress={refresh} />}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3], marginBottom: space[5] }}>
        <Kpi accent label="Por pagar" value={num(pending.length)} icon={HandCoins} />
        <Kpi label="Monto por pagar" value={cop(pending.reduce((a, w) => a + w.amount, 0))} icon={Banknote} />
        <Kpi label="Pagado este mes" value={cop(paidMonth.reduce((a, w) => a + w.amount, 0))} />
      </View>
      <Row style={{ gap: 6, marginBottom: space[3], flexWrap: 'wrap' }}>
        <Chip label={`Por pagar (${pending.length})`} active={filter === 'procesando'} onPress={() => setFilter('procesando')} />
        <Chip label="Todos" active={filter === 'all'} onPress={() => setFilter('all')} />
      </Row>
      <Panel padded={false}>
        <DataTable<WithdrawalRow>
          rows={list}
          keyOf={(w) => w.id}
          empty={
            <EmptyState
              icon={CheckCheck}
              title={rows === null ? 'Cargando…' : filter === 'procesando' ? 'Nada por pagar' : 'Aún no hay retiros'}
              body="Cuando un conductor pida un retiro desde su billetera aparecerá aquí."
            />
          }
          columns={[
            {
              key: 'driver',
              label: 'Conductor',
              flex: 1.4,
              render: (w) => (
                <View>
                  <Txt v="smallStrong" numberOfLines={1}>
                    {w.driver || 'Conductor'}
                  </Txt>
                  <Txt v="caption" color={colors.inkMuted} selectable>
                    {w.phone ?? '—'}
                  </Txt>
                </View>
              ),
            },
            {
              key: 'dest',
              label: 'Enviar a',
              flex: 1.5,
              render: (w) => (
                <View>
                  <Txt v="caption" color={colors.inkMuted}>
                    {METHOD[w.method ?? ''] ?? w.method ?? '—'}
                  </Txt>
                  {w.account ? <CopyText text={w.account} /> : <Txt v="small">—</Txt>}
                </View>
              ),
            },
            {
              key: 'amount',
              label: 'Monto',
              flex: 0.9,
              render: (w) => (
                <Txt v="bodyStrong" tabular>
                  {cop(w.amount)}
                </Txt>
              ),
            },
            {
              key: 'date',
              label: 'Pedido',
              flex: 0.9,
              render: (w) => (
                <View>
                  <Txt v="small">{dayLabel(new Date(w.createdAt))}</Txt>
                  <Txt v="caption" color={colors.inkMuted}>
                    {clock(new Date(w.createdAt))}
                  </Txt>
                </View>
              ),
            },
            {
              key: 'status',
              label: 'Estado',
              flex: 1.1,
              render: (w) => (
                <View style={{ gap: 4 }}>
                  <Badge label={STATUS[w.status].l} tone={STATUS[w.status].t} dot />
                  {w.note ? (
                    <Txt v="caption" color={colors.inkMuted} numberOfLines={2}>
                      {w.note}
                    </Txt>
                  ) : null}
                </View>
              ),
            },
            {
              key: 'act',
              label: '',
              width: 250,
              align: 'right',
              render: (w) =>
                w.status === 'procesando' ? (
                  <Row style={{ gap: 6 }}>
                    <Button label="Marcar pagado" icon={CheckCheck} variant="dark" size="sm" full={false} onPress={() => setResolving({ row: w, action: 'completado' })} />
                    <Button label="Rechazar" variant="outline" size="sm" full={false} onPress={() => setResolving({ row: w, action: 'rechazado' })} />
                  </Row>
                ) : w.processedAt ? (
                  <Txt v="caption" color={colors.inkMuted}>
                    {dayLabel(new Date(w.processedAt))} {clock(new Date(w.processedAt))}
                  </Txt>
                ) : null,
            },
          ]}
        />
      </Panel>
      <ResolveModal row={resolving?.row ?? null} action={resolving?.action ?? 'completado'} onClose={() => setResolving(null)} onDone={refresh} />
    </ScrollView>
  );
}
