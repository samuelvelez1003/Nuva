import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Megaphone, Plus, Ticket, Trash2 } from 'lucide-react-native';
import { PageHead, Panel, useWide } from '../../components/admin/AdminKit';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge, EmptyState, Field, Row } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { PromoRow, usePromos } from '../../lib/adminData';
import { calculateFare } from '../../lib/fare';
import { cop, decimal, moneyCurrency, num, parseDecimal, parseInteger, toMajor, toMinor } from '../../lib/format';
import { activeCountry } from '../../lib/region';
import { COUNTRIES } from '../../lib/countries';

const activeCountryName = () => COUNTRIES[activeCountry()].name;
import { supabase } from '../../lib/supabase';
import { useApp } from '../../store/AppStore';
import { colors, fonts, radius, space } from '../../theme/tokens';

const STATUS = { activa: { l: 'Activa', t: 'success' as const }, programada: { l: 'Programada', t: 'info' as const }, finalizada: { l: 'Finalizada', t: 'neutral' as const } };

/** Promotional campaigns stored on the server. */
export default function Promotions() {
  const wide = useWide(1180);
  const toast = useToast();
  const { pricing } = useApp();
  const { rows: promos, refresh } = usePromos();
  // Budget used and completed trips per campaign (server-computed).
  const [usage, setUsage] = useState<Record<string, { uses: number; spent: number }>>({});
  useEffect(() => {
    supabase?.rpc('admin_promo_usage', { p_country: activeCountry() }).then(({ data }) => data && setUsage(data as Record<string, { uses: number; spent: number }>));
  }, [promos]);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [discount, setDiscount] = useState(15);
  // Money in minor units of the active currency (XCG cents): sensible defaults per country.
  const cents = moneyCurrency().minorDigits === 2;
  const [cap, setCap] = useState(cents ? 500 : 5000);
  const [budget, setBudget] = useState(cents ? 100_000 : 1_000_000);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const showMoney = (v: number) => (cents ? decimal(toMajor(v), 2) : num(v));
  const readMoney = (t: string) => (cents ? toMinor(parseDecimal(t)) : parseInteger(t));

  // Cost preview on a typical 5 km Go trip with the live rates.
  const sample = calculateFare({ distanceKm: 5, durationMin: 15 }, pricing, 'go');
  const perTrip = Math.min(cap, Math.round((sample.finalFare * discount) / 100));
  const coverage = perTrip ? Math.floor(budget / perTrip) : 0;
  const valid = /^[A-Z0-9]{4,12}$/.test(code) && title.trim().length > 4 && discount > 0 && discount <= 60 && budget > 0;

  const create = async () => {
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.from('promos').insert({ code, title: title.trim(), discount_pct: discount, cap, budget, status: 'programada', country: activeCountry() });
    setSaving(false);
    if (error) return toast(error.message.includes('duplicate') ? 'Ya existe una campaña con ese código' : error.message, 'warning');
    toast(`Campaña ${code} creada`);
    setCode('');
    setTitle('');
    refresh();
  };

  const toggle = async (p: PromoRow) => {
    const { error } = await supabase!.from('promos').update({ status: p.status === 'activa' ? 'programada' : 'activa' }).eq('id', p.id);
    if (error) return toast(error.message, 'warning');
    refresh();
  };

  const remove = async (p: PromoRow) => {
    // Two taps: deleting a campaign can't be undone.
    if (confirmDelete !== p.id) {
      setConfirmDelete(p.id);
      return toast(`Toca otra vez la papelera para eliminar ${p.code}`, 'info');
    }
    setConfirmDelete(null);
    const { error } = await supabase!.from('promos').delete().eq('id', p.id);
    if (error) return toast(error.message, 'warning');
    toast('Campaña eliminada', 'info');
    refresh();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: wide ? space[10] : space[4], paddingBottom: 120, maxWidth: 1440, width: '100%', alignSelf: 'center' }}>
      <PageHead kicker={`Crecimiento · ${activeCountryName()}`} title="Promociones" subtitle="Campañas guardadas en el servidor. El conductor siempre gana sobre la tarifa completa." />
      <View style={{ marginBottom: space[5], padding: space[4], borderRadius: radius.md, backgroundColor: colors.ivory100 }}>
        <Txt v="smallStrong">Cómo funciona</Txt>
        <Txt v="small" color={colors.inkSoft} style={{ marginTop: 2 }}>
          El pasajero escribe el código antes de pedir. Solo sirven las campañas «Activas» de este país, una vez por pasajero y hasta agotar el presupuesto. El pasajero le paga al conductor el precio con descuento y, al terminar el viaje, NÜVA le abona el descuento al conductor en su saldo.
        </Txt>
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[5], alignItems: 'flex-start' }}>
        <View style={{ flex: wide ? 1.4 : undefined, width: wide ? undefined : '100%', gap: space[3] }}>
          {promos && promos.length === 0 ? (
            <Panel>
              <EmptyState icon={Megaphone} title="Aún no hay campañas" body="Crea la primera con el formulario. Queda programada hasta que la actives." />
            </Panel>
          ) : null}
          {(promos ?? []).map((p) => (
            <Panel key={p.id}>
              <Row style={{ justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <Row style={{ gap: 12, flex: 1 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: p.status === 'activa' ? colors.lime : colors.ivory200, alignItems: 'center', justifyContent: 'center' }}>
                    <Txt style={{ fontFamily: fonts.extrabold, fontSize: 15 }}>{p.discount_pct}%</Txt>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="title">{p.title}</Txt>
                    <Row style={{ gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.ivory400 }}>
                        <Txt v="caption" style={{ fontFamily: fonts.extrabold, letterSpacing: 1 }}>
                          {p.code}
                        </Txt>
                      </View>
                      <Txt v="caption" color={colors.inkMuted}>
                        Tope {cop(p.cap)} · usado {cop(usage[p.id]?.spent ?? 0)} de {cop(p.budget)} · {num(usage[p.id]?.uses ?? 0)} viajes
                      </Txt>
                    </Row>
                  </View>
                </Row>
                <Badge label={STATUS[p.status].l} tone={STATUS[p.status].t} dot />
              </Row>
              <Row style={{ gap: 8, marginTop: space[4] }}>
                {p.status !== 'finalizada' ? (
                  <Button label={p.status === 'activa' ? 'Pausar' : 'Activar'} variant={p.status === 'activa' ? 'outline' : 'dark'} size="sm" full={false} onPress={() => toggle(p)} />
                ) : null}
                <IconButton icon={Trash2} label={`Eliminar ${p.code}`} tone="clear" size={36} onPress={() => remove(p)} />
              </Row>
            </Panel>
          ))}
        </View>

        <Panel title="Nueva campaña" subtitle="Simula el costo antes de crearla" style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%' }} right={<Megaphone size={18} color={colors.inkMuted} />}>
          <View style={{ gap: space[4] }}>
            <Field label="Código" placeholder="EJ. LLUVIA20" value={code} onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))} autoCapitalize="characters" error={code && code.length < 4 ? 'Mínimo 4 caracteres' : undefined} />
            <Field label="Nombre visible" placeholder="Ej. Días de lluvia: 20 %" value={title} onChangeText={setTitle} />
            <Row style={{ gap: 12 }}>
              <Field label="Descuento" suffix="%" value={String(discount)} onChangeText={(t) => setDiscount(Math.min(99, parseInteger(t)))} keyboardType="number-pad" style={{ flex: 1 }} error={discount > 60 ? 'Máximo 60 %' : undefined} />
              <Field label="Tope por viaje" prefix={moneyCurrency().symbol} value={showMoney(cap)} onChangeText={(t) => setCap(readMoney(t))} keyboardType={cents ? 'decimal-pad' : 'number-pad'} style={{ flex: 1 }} />
            </Row>
            <Field label="Presupuesto total" prefix={moneyCurrency().symbol} value={showMoney(budget)} onChangeText={(t) => setBudget(readMoney(t))} keyboardType={cents ? 'decimal-pad' : 'number-pad'} />
            <View style={{ padding: space[4], borderRadius: radius.md, backgroundColor: colors.ivory100, gap: 6 }}>
              <Row style={{ gap: 8 }}>
                <Ticket size={16} color={colors.ink} />
                <Txt v="smallStrong">En un viaje Go de 5 km ({cop(sample.finalFare)})</Txt>
              </Row>
              <Txt v="small" color={colors.inkSoft}>
                Pasajero paga {cop(sample.finalFare - perTrip)} · conductor recibe {cop(sample.driverEarnings)} · NÜVA invierte {cop(perTrip)}
              </Txt>
              <Txt v="small" color={colors.inkSoft}>
                El presupuesto cubre ≈ {num(coverage)} viajes.
              </Txt>
            </View>
            <Button label="Crear campaña" icon={Plus} variant="dark" disabled={!valid} loading={saving} onPress={create} />
          </View>
        </Panel>
      </View>
    </ScrollView>
  );
}
