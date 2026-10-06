import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Landmark, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { PageHead, Panel, useWide } from '../../components/admin/AdminKit';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge, Chip, EmptyState, Field, Row } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { BankAccountRow, useBankAccounts } from '../../lib/adminData';
import { COUNTRIES } from '../../lib/countries';
import { activeCountry } from '../../lib/region';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radius, space } from '../../theme/tokens';

/** Suggestions per country; any other bank or type can be typed. */
const LOCAL = {
  CO: { banks: ['Bancolombia', 'Davivienda', 'Banco de Bogotá', 'BBVA', 'Nequi', 'Daviplata'], types: ['Ahorros', 'Corriente', 'Billetera'], idLabel: 'NIT o cédula del titular', idPh: 'Ej. 901.234.567-8' },
  CW: { banks: ['MCB', 'Banco di Caribe', 'RBC', 'Orco Bank'], types: ['Ahorros', 'Corriente'], idLabel: 'CRIB o KvK del titular', idPh: 'Ej. 123456789' },
} as const;

type Draft = Pick<BankAccountRow, 'bank' | 'account_type' | 'number' | 'holder' | 'holder_id' | 'note'>;
const EMPTY: Draft = { bank: '', account_type: '', number: '', holder: '', holder_id: '', note: '' };

/** NÜVA's own accounts per country: drivers see the active ones when they top up. */
export default function BankAccounts() {
  const wide = useWide(1180);
  const toast = useToast();
  const code = activeCountry();
  const local = LOCAL[code as keyof typeof LOCAL] ?? LOCAL.CO;
  const { rows, refresh } = useBankAccounts();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const set = (k: keyof Draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const valid = draft.bank.trim().length >= 2 && draft.number.trim().length >= 3 && draft.holder.trim().length >= 2;
  const active = (rows ?? []).filter((r) => r.active);

  const reset = () => {
    setDraft(EMPTY);
    setEditing(null);
  };

  const save = async () => {
    if (!supabase || !valid) return;
    setSaving(true);
    const row = {
      bank: draft.bank.trim(),
      account_type: draft.account_type.trim(),
      number: draft.number.trim(),
      holder: draft.holder.trim(),
      holder_id: draft.holder_id.trim(),
      note: draft.note.trim(),
    };
    const { error } = editing ? await supabase.from('bank_accounts').update(row).eq('id', editing) : await supabase.from('bank_accounts').insert({ ...row, country: code });
    setSaving(false);
    if (error) return toast(error.message, 'warning');
    toast(editing ? 'Cuenta actualizada' : 'Cuenta agregada');
    reset();
    refresh();
  };

  const edit = (r: BankAccountRow) => {
    setEditing(r.id);
    setDraft({ bank: r.bank, account_type: r.account_type, number: r.number, holder: r.holder, holder_id: r.holder_id, note: r.note });
  };

  const toggle = async (r: BankAccountRow) => {
    const { error } = await supabase!.from('bank_accounts').update({ active: !r.active }).eq('id', r.id);
    if (error) return toast(error.message, 'warning');
    toast(r.active ? 'Cuenta oculta para los conductores' : 'Cuenta visible para los conductores', 'info');
    refresh();
  };

  const remove = async (r: BankAccountRow) => {
    // Two taps: deleting can't be undone.
    if (confirmDelete !== r.id) {
      setConfirmDelete(r.id);
      return toast(`Toca otra vez la papelera para eliminar ${r.bank} ${r.number}`, 'info');
    }
    setConfirmDelete(null);
    const { error } = await supabase!.from('bank_accounts').delete().eq('id', r.id);
    if (error) return toast(error.message, 'warning');
    if (editing === r.id) reset();
    toast('Cuenta eliminada', 'info');
    refresh();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: wide ? space[10] : space[4], paddingBottom: 120, maxWidth: 1440, width: '100%', alignSelf: 'center' }}>
      <PageHead
        kicker={`Finanzas · ${COUNTRIES[code].name}`}
        title="Cuentas bancarias"
        subtitle="Las cuentas de NÜVA donde los conductores transfieren para recargar su saldo. Cámbialas cuando quieras: la app las muestra al instante."
      />
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[5], alignItems: 'flex-start' }}>
        <View style={{ flex: wide ? 1.4 : undefined, width: wide ? undefined : '100%', gap: space[3] }}>
          {rows && rows.length === 0 ? (
            <Panel>
              <EmptyState icon={Landmark} title="Aún no hay cuentas" body={`Agrega la primera cuenta de ${COUNTRIES[code].name} con el formulario.`} />
            </Panel>
          ) : null}
          {(rows ?? []).map((r) => (
            <Panel key={r.id} style={editing === r.id ? { borderWidth: 2, borderColor: colors.midnight } : undefined}>
              <Row style={{ justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <Row style={{ gap: 12, flex: 1, alignItems: 'flex-start' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: r.active ? colors.lime : colors.ivory200, alignItems: 'center', justifyContent: 'center' }}>
                    <Landmark size={20} color={colors.midnight} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt v="title">
                      {r.bank}
                      {r.account_type ? ` · ${r.account_type}` : ''}
                    </Txt>
                    <Txt selectable style={{ fontFamily: fonts.extrabold, fontSize: 18, letterSpacing: 0.5, marginTop: 2 }}>
                      {r.number}
                    </Txt>
                    <Txt v="small" color={colors.inkSoft} style={{ marginTop: 2 }}>
                      {r.holder}
                      {r.holder_id ? ` · ${r.holder_id}` : ''}
                    </Txt>
                    {r.note ? (
                      <Txt v="caption" color={colors.inkMuted} style={{ marginTop: 4 }}>
                        {r.note}
                      </Txt>
                    ) : null}
                  </View>
                </Row>
                <Badge label={r.active ? 'Visible' : 'Oculta'} tone={r.active ? 'success' : 'neutral'} dot />
              </Row>
              <Row style={{ gap: 8, marginTop: space[4] }}>
                <Button label="Editar" icon={Pencil} variant="outline" size="sm" full={false} onPress={() => edit(r)} />
                <Button label={r.active ? 'Ocultar' : 'Mostrar'} variant={r.active ? 'outline' : 'dark'} size="sm" full={false} onPress={() => toggle(r)} />
                <IconButton icon={Trash2} label={`Eliminar ${r.bank}`} tone="clear" size={36} onPress={() => remove(r)} />
              </Row>
            </Panel>
          ))}
        </View>

        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: space[5] }}>
          <Panel
            title={editing ? 'Editar cuenta' : 'Nueva cuenta'}
            subtitle={COUNTRIES[code].name}
            right={editing ? <IconButton icon={X} label="Cancelar edición" tone="clear" size={32} onPress={reset} /> : <Landmark size={18} color={colors.inkMuted} />}
          >
            <View style={{ gap: space[4] }}>
              <View>
                <Field label="Banco" placeholder="Nombre del banco" value={draft.bank} onChangeText={set('bank')} />
                <Row style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {local.banks.map((b) => (
                    <Chip key={b} label={b} active={draft.bank === b} onPress={() => set('bank')(b)} />
                  ))}
                </Row>
              </View>
              <View>
                <Field label="Tipo de cuenta" placeholder="Ej. Ahorros" value={draft.account_type} onChangeText={set('account_type')} />
                <Row style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {local.types.map((b) => (
                    <Chip key={b} label={b} active={draft.account_type === b} onPress={() => set('account_type')(b)} />
                  ))}
                </Row>
              </View>
              <Field label="Número de cuenta" placeholder="Ej. 123-456789-01" value={draft.number} onChangeText={set('number')} autoCapitalize="none" />
              <Field label="Titular" placeholder="Ej. NÜVA Movilidad S.A.S." value={draft.holder} onChangeText={set('holder')} />
              <Field label={local.idLabel} placeholder={local.idPh} value={draft.holder_id} onChangeText={set('holder_id')} />
              <Field label="Nota para el conductor (opcional)" placeholder="Ej. Pon tu celular en la referencia" value={draft.note} onChangeText={set('note')} maxLength={160} />
              <Button label={editing ? 'Guardar cambios' : 'Agregar cuenta'} icon={editing ? Pencil : Plus} variant="dark" disabled={!valid} loading={saving} onPress={save} />
            </View>
          </Panel>

          <Panel title="Así lo ve el conductor" subtitle="Billetera → Recargar">
            {active.length ? (
              <View style={{ gap: 10, padding: space[4], borderRadius: radius.md, backgroundColor: colors.midnight }}>
                {active.map((r) => (
                  <View key={r.id}>
                    <Txt v="smallStrong" color={colors.ivory}>
                      {r.bank}
                      {r.account_type ? ` · ${r.account_type}` : ''}
                    </Txt>
                    <Txt color={colors.lime} style={{ fontFamily: fonts.extrabold, fontSize: 17 }}>
                      {r.number}
                    </Txt>
                    <Txt v="caption" color={colors.onDarkMuted}>
                      {r.holder}
                      {r.holder_id ? ` · ${r.holder_id}` : ''}
                    </Txt>
                  </View>
                ))}
              </View>
            ) : (
              <Txt v="small" color={colors.inkMuted}>
                No hay cuentas visibles: los conductores de {COUNTRIES[code].name} no verán datos para transferir.
              </Txt>
            )}
          </Panel>
        </View>
      </View>
    </ScrollView>
  );
}
