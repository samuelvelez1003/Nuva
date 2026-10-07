import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, Switch, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowRight, Bike, Car, Info, Minus, Moon, Plane, Plus, RotateCcw, Send, Sparkles, TrendingDown, TrendingUp, Users, Zap } from 'lucide-react-native';
import { DataTable, Panel, PageHead, Slider, useWide } from '../../components/admin/AdminKit';
import { FareBreakdownCard } from '../../components/fare/FareBreakdownCard';
import { Button, IconButton, Tap } from '../../components/ui/Button';
import { Badge, Chip, Divider, Field, Row, Segmented } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Screen';
import { Money, Txt } from '../../components/ui/Txt';
import { useAdminTrips } from '../../lib/adminData';
import { Flag } from '../../components/brand/Flags';
import { COUNTRIES, COUNTRY_ORDER, CountryCode } from '../../lib/countries';
import { useCountry } from '../../lib/country';
import { setUnsaved } from '../../lib/region';
import { calculateFare, CategoryId, CATEGORY_ORDER, CategoryPricing, defaultPricingFor, defaultSurchargesFor, PricingConfig, Surcharges, validatePricing } from '../../lib/fare';
import { cop, copCompact, copDelta, decimal, km, minutes, moneyCurrency, num, parseDecimal, parseInteger, pct } from '../../lib/format';
import { projectMonth } from '../../lib/metrics';
import { NuvaSettings, useNuvaSettings } from '../../lib/settings';
import { useApp } from '../../store/AppStore';
import { colors, fonts, radius, space } from '../../theme/tokens';

const CAT_ICON: Record<CategoryId, typeof Car> = { moto: Bike, go: Car, eco: Zap, confort: Sparkles, xl: Users };
const PRESETS: Record<CountryCode, { label: string; d: number; t: number }[]> = {
  CO: [
    { label: 'Corto · 1,2 km', d: 1.2, t: 5 },
    { label: 'Centro → Circunvalar', d: 3.5, t: 12 },
    { label: 'UTP → Unicentro', d: 6.8, t: 21 },
    { label: 'Dosquebradas → Matecaña', d: 9.6, t: 30 },
  ],
  CW: [
    { label: 'Corto · 1,2 km', d: 1.2, t: 5 },
    { label: 'Punda → Pietermaai', d: 2.2, t: 8 },
    { label: 'Aeropuerto → Punda', d: 12.8, t: 20 },
    { label: 'Punda → Westpunt', d: 38, t: 45 },
  ],
};

/**
 * Each country has its own pricing versions and wallet rules. This switch makes
 * explicit which country's tariffs are on screen; switching reloads that country's.
 */
function CountryTariffTabs({ dirty }: { dirty: boolean }) {
  const toast = useToast();
  const { code, setCountry } = useCountry();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3], marginBottom: space[6] }}>
      {COUNTRY_ORDER.map((c) => {
        const k = COUNTRIES[c];
        const active = c === code;
        return (
          <Tap
            key={c}
            haptics={false}
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Tarifas de ${k.name}`}
            onPress={() => {
              if (active) return;
              if (dirty) return toast('Publica o restablece los cambios antes de cambiar de país', 'info');
              setCountry(c);
            }}
            style={{
              flexGrow: 1,
              flexBasis: 240,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              padding: space[4],
              borderRadius: radius.lg,
              borderWidth: 1.5,
              borderColor: active ? colors.midnight : colors.lineLight,
              backgroundColor: active ? colors.midnight : colors.white,
            }}
          >
            <View style={{ borderRadius: 4, overflow: 'hidden' }}>
              <Flag code={c} width={36} radius={4} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="bodyStrong" color={active ? colors.ivory : colors.ink}>
                Tarifas de {k.name}
              </Txt>
              <Txt v="caption" color={active ? colors.onDarkMuted : colors.inkMuted}>
                {k.currencyName} · {k.currency}
              </Txt>
            </View>
            {active ? <Badge label="Editando" tone="lime" /> : null}
          </Tap>
        );
      })}
    </View>
  );
}

/**
 * Money fields hold minor units (COP pesos, XCG cents). In guilders the admin
 * reads and types "7,00"; the value stored stays in cents.
 */
const hasCents = () => moneyCurrency().minorDigits === 2;
/** Stepper size per currency: (pesos step, cents step). */
const step = (copStep: number, centsStep: number) => (hasCents() ? centsStep : copStep);
const moneyPrefix = () => moneyCurrency().symbol;
function moneyIO(money: boolean | undefined, decimals: number) {
  const cents = !!money && hasCents();
  return {
    show: (v: number) => (cents ? decimal(v / 100, 2) : decimals ? decimal(v, decimals) : num(v)),
    edit: (v: number) => (cents ? decimal(v / 100, 2) : decimals ? decimal(v, decimals) : String(v)),
    parse: (t: string) => (cents ? Math.round(parseDecimal(t) * 100) : decimals ? parseDecimal(t) : parseInteger(t)),
  };
}

/** Integer field with stepper, change marker and inline validation. */
function NumberField({
  label,
  hint,
  value,
  published,
  onChange,
  step,
  prefix,
  suffix,
  error,
  decimals = 0,
  money,
}: {
  label: string;
  hint?: string;
  value: number;
  published: number;
  onChange: (v: number) => void;
  step: number;
  prefix?: string;
  suffix?: string;
  error?: string;
  decimals?: number;
  /** Amount in minor units, shown in the active currency. */
  money?: boolean;
}) {
  const changed = value !== published;
  const [text, setText] = useState<string | null>(null);
  const io = moneyIO(money, decimals);
  if (money) prefix = moneyPrefix();
  const shown = text ?? io.show(value);
  return (
    <View style={{ flexGrow: 1, flexBasis: 220 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <Row style={{ gap: 6 }}>
          <Txt v="smallStrong">{label}</Txt>
          {changed ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime, borderWidth: 1, borderColor: colors.midnight }} accessibilityLabel="Modificado" /> : null}
        </Row>
        {changed ? (
          <Txt v="caption" color={colors.inkMuted} tabular>
            antes {prefix ?? ''}
            {io.show(published)}
            {suffix ?? ''}
          </Txt>
        ) : null}
      </Row>
      <Row style={{ height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: error ? colors.danger : changed ? colors.midnight : colors.lineLightStrong, backgroundColor: colors.white, paddingLeft: 14, paddingRight: 0, gap: 4 }}>
        {prefix ? (
          <Txt v="bodyStrong" color={colors.inkMuted}>
            {prefix}
          </Txt>
        ) : null}
        <TextInput
          value={shown}
          onFocus={() => setText(io.edit(value))}
          onChangeText={(t) => {
            setText(t);
            onChange(io.parse(t));
          }}
          onBlur={() => setText(null)}
          keyboardType="decimal-pad"
          accessibilityLabel={label}
          style={[{ flex: 1, minWidth: 0, width: 10, height: '100%', fontFamily: fonts.bold, fontSize: 18, color: colors.ink, fontVariant: ['tabular-nums'] }, { outlineStyle: 'none' } as object]}
        />
        {suffix ? (
          <Txt v="bodyStrong" color={colors.inkMuted} style={{ marginRight: 4 }}>
            {suffix}
          </Txt>
        ) : null}
        <IconButton icon={Minus} label={`Reducir ${label}`} tone="clear" size={38} onPress={() => onChange(Math.max(0, Number((value - step).toFixed(decimals))))} />
        <IconButton icon={Plus} label={`Aumentar ${label}`} tone="clear" size={38} onPress={() => onChange(Number((value + step).toFixed(decimals)))} />
      </Row>
      {error ? (
        <Txt v="caption" color={colors.dangerInk} style={{ marginTop: 4 }}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt v="caption" color={colors.inkMuted} style={{ marginTop: 4 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

function SmallInput({ value, onChange, label, decimals, width = 92, prefix, money }: { value: number; onChange: (v: number) => void; label: string; decimals?: number; width?: number; prefix?: string; money?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const io = moneyIO(money, decimals ?? 0);
  if (money) prefix = moneyPrefix();
  return (
    <Row style={{ width, height: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.lineLightStrong, paddingHorizontal: 10, backgroundColor: colors.white, gap: 2 }}>
      {prefix ? (
        <Txt v="caption" color={colors.inkMuted}>
          {prefix}
        </Txt>
      ) : null}
      <TextInput
        value={text ?? io.show(value)}
        onFocus={() => setText(io.edit(value))}
        onChangeText={(t) => {
          setText(t);
          onChange(io.parse(t));
        }}
        onBlur={() => setText(null)}
        keyboardType="decimal-pad"
        accessibilityLabel={label}
        style={[{ flex: 1, width: 10, fontFamily: fonts.bold, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'], minWidth: 0 }, { outlineStyle: 'none' } as object]}
      />
    </Row>
  );
}

function Delta({ value, money = true, invert }: { value: number; money?: boolean; invert?: boolean }) {
  if (!value) return <Badge label="Sin cambio" tone="neutral" />;
  const good = invert ? value < 0 : value > 0;
  return <Badge label={money ? copDelta(value) : `${value > 0 ? '+' : '−'}${decimal(Math.abs(value) * 100, 1)} %`} tone={good ? 'success' : 'danger'} />;
}

/** "HH:MM" text field (24 h) for the night window. */
function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 140 }}>
      <Field label={label} value={value} onChangeText={(t) => onChange(t.replace(/[^\d:]/g, '').slice(0, 5))} placeholder="19:00" keyboardType="numbers-and-punctuation" />
    </View>
  );
}

/**
 * Night and airport surcharges (versioned with the tariffs). Added on top of the
 * fare; the commission applies to the total. The server charges exactly this.
 */
function SurchargesPanel({ value, published, onChange, error }: { value: Surcharges; published: Surcharges; onChange: (v: Surcharges) => void; error?: string }) {
  const night = (patch: Partial<Surcharges['night']>) => onChange({ ...value, night: { ...value.night, ...patch } });
  const airport = (patch: Partial<Surcharges['airport']>) => onChange({ ...value, airport: { ...value.airport, ...patch } });
  return (
    <Panel title="Recargos" subtitle="Se suman a la tarifa al pedir el viaje; la comisión aplica sobre el total. El pasajero los ve en su cotización.">
      <View style={{ gap: space[5] }}>
        {error ? (
          <Txt v="caption" color={colors.dangerInk}>
            {error}
          </Txt>
        ) : null}
        <View style={{ gap: space[3] }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row style={{ gap: 10, flex: 1 }}>
              <Moon size={18} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong">Recargo nocturno</Txt>
                <Txt v="caption" color={colors.inkMuted}>
                  Hora local del país. La franja puede cruzar la medianoche.
                </Txt>
              </View>
            </Row>
            <Switch value={value.night.enabled} onValueChange={(v) => night({ enabled: v })} accessibilityLabel="Activar recargo nocturno" />
          </Row>
          {value.night.enabled ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
              <NumberField label="Valor" money value={value.night.amount} published={published.night.amount} step={step(100, 25)} onChange={(v) => night({ amount: v })} />
              <TimeField label="Desde (24 h)" value={value.night.from} onChange={(v) => night({ from: v })} />
              <TimeField label="Hasta (24 h)" value={value.night.to} onChange={(v) => night({ to: v })} />
            </View>
          ) : null}
        </View>
        <Divider />
        <View style={{ gap: space[3] }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row style={{ gap: 10, flex: 1 }}>
              <Plane size={18} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong">Recargo de aeropuerto</Txt>
                <Txt v="caption" color={colors.inkMuted}>
                  Zona: círculo sobre la entrada de la terminal. Si el viaje empieza y termina ahí, se cobran ambos.
                </Txt>
              </View>
            </Row>
            <Switch value={value.airport.enabled} onValueChange={(v) => airport({ enabled: v })} accessibilityLabel="Activar recargo de aeropuerto" />
          </Row>
          {value.airport.enabled ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
              <NumberField label="Recoger en el aeropuerto" money value={value.airport.pickup} published={published.airport.pickup} step={step(100, 25)} onChange={(v) => airport({ pickup: v })} hint="El viaje empieza en la terminal" />
              <NumberField label="Dejar en el aeropuerto" money value={value.airport.dropoff} published={published.airport.dropoff} step={step(100, 25)} onChange={(v) => airport({ dropoff: v })} hint="El viaje termina en la terminal" />
              <NumberField label="Radio de la zona" suffix="m" value={value.airport.radiusM} published={published.airport.radiusM} step={50} onChange={(v) => airport({ radiusM: v })} hint="Pequeño: lugares cercanos (Unicentro) no pagan" />
            </View>
          ) : null}
        </View>
      </View>
    </Panel>
  );
}

/**
 * Prepaid-wallet rules (table nuva_settings). Saved on their own — they don't
 * create a new pricing version and apply immediately on the server.
 */
function WalletRules() {
  const toast = useToast();
  const { settings, save } = useNuvaSettings();
  const [draft, setDraft] = useState<NuvaSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const d = draft ?? settings;
  const dirty = !!draft && (draft.welcomeBonus !== settings.welcomeBonus || draft.minTopup !== settings.minTopup || draft.lowBalance !== settings.lowBalance);
  // Tells the sidebar's country switch there are unsaved wallet rules.
  useEffect(() => {
    setUnsaved('wallet-rules', dirty);
    return () => setUnsaved('wallet-rules', false);
  }, [dirty]);
  const set = (k: keyof NuvaSettings, v: number) => setDraft({ ...d, [k]: v });
  const error =
    d.minTopup < step(5000, 100) ? `La recarga mínima debe ser de al menos ${cop(step(5000, 100))}` : undefined;

  return (
    <Panel title="Billetera de conductores" subtitle="Los pasajeros pagan directo al conductor; la comisión sale de su saldo prepago. Estas reglas aplican de inmediato.">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
        <NumberField label="Bono de bienvenida" money value={d.welcomeBonus} published={settings.welcomeBonus} step={step(5000, 500)} onChange={(v) => set('welcomeBonus', v)} hint="Se acredita al aprobar un conductor. 0 = sin bono" />
        <NumberField label="Recarga mínima" money value={d.minTopup} published={settings.minTopup} step={step(5000, 500)} onChange={(v) => set('minTopup', v)} hint="Monto mínimo por recarga de saldo" />
        <NumberField label="Alerta de saldo bajo" money value={d.lowBalance} published={settings.lowBalance} step={step(1000, 100)} onChange={(v) => set('lowBalance', v)} hint="Debajo de esto el conductor ve el aviso de recargar" />
      </View>
      {error ? (
        <Txt v="caption" color={colors.dangerInk} style={{ marginTop: 8 }}>
          {error}
        </Txt>
      ) : null}
      <Row style={{ gap: 10, marginTop: space[4] }}>
        <Button
          label="Guardar reglas"
          icon={Send}
          variant="dark"
          size="md"
          full={false}
          disabled={!dirty || !!error}
          loading={saving}
          onPress={async () => {
            setSaving(true);
            try {
              await save(d);
              setDraft(null);
              toast('Reglas de billetera actualizadas');
            } catch (e) {
              toast(e instanceof Error ? e.message : 'No se pudo guardar', 'warning');
            } finally {
              setSaving(false);
            }
          }}
        />
        {dirty ? <Button label="Descartar" variant="ghost" size="md" full={false} onPress={() => setDraft(null)} /> : null}
      </Row>
    </Panel>
  );
}

export default function PricingConfigPage() {
  const toast = useToast();
  const wide = useWide(1180);
  const { pricing, publishPricing, pricingVersion } = useApp();
  const { code, country } = useCountry();
  const [draft, setDraft] = useState<PricingConfig>(pricing);
  // The country's live pricing arrives after mount (and on every publish from
  // another admin): follow it unless the admin has unpublished edits.
  const baseRef = useRef(pricing);
  useEffect(() => {
    const base = JSON.stringify(baseRef.current);
    setDraft((d) => (JSON.stringify(d) === base ? pricing : d));
    baseRef.current = pricing;
  }, [pricing]);
  const [distance, setDistance] = useState(3.5);
  const [duration, setDuration] = useState(12);
  const [cat, setCat] = useState<CategoryId>('go');
  const [confirm, setConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Frozen copy for the dialog so it doesn't empty out while fading after publish.
  const [pending, setPending] = useState<{ label: string; from: string; to: string }[]>([]);
  const [pendingImpact, setPendingImpact] = useState(0);

  const errors = validatePricing(draft);
  const hasErrors = Object.keys(errors).length > 0;

  const changes = useMemo(() => {
    const list: { label: string; from: string; to: string }[] = [];
    const f = (k: 'baseFare' | 'pricePerKm' | 'pricePerMinute' | 'minimumFare', label: string) => {
      if (draft[k] !== pricing[k]) list.push({ label, from: cop(pricing[k]), to: cop(draft[k]) });
    };
    f('baseFare', 'Tarifa base');
    f('pricePerKm', 'Precio por km');
    f('pricePerMinute', 'Precio por minuto');
    f('minimumFare', 'Tarifa mínima');
    if (draft.commissionPct !== pricing.commissionPct) list.push({ label: 'Comisión', from: pct(pricing.commissionPct, 1), to: pct(draft.commissionPct, 1) });
    for (const id of CATEGORY_ORDER) {
      const a = pricing.categories[id];
      const b = draft.categories[id];
      if (a.multiplier !== b.multiplier) list.push({ label: `${b.name} · multiplicador`, from: `×${decimal(a.multiplier, 2)}`, to: `×${decimal(b.multiplier, 2)}` });
      if (a.minimumFare !== b.minimumFare) list.push({ label: `${b.name} · mínima`, from: cop(a.minimumFare), to: cop(b.minimumFare) });
      if (a.enabled !== b.enabled) list.push({ label: `${b.name}`, from: a.enabled ? 'Activa' : 'Pausada', to: b.enabled ? 'Activa' : 'Pausada' });
      if ((a.commissionPct ?? null) !== (b.commissionPct ?? null))
        list.push({ label: `${b.name} · comisión`, from: a.commissionPct == null ? 'Global' : pct(a.commissionPct, 1), to: b.commissionPct == null ? 'Global' : pct(b.commissionPct, 1) });
    }
    const a = pricing.surcharges ?? defaultSurchargesFor(code);
    const b = draft.surcharges ?? a;
    const onOff = (v: boolean) => (v ? 'Activo' : 'Apagado');
    if (a.night.enabled !== b.night.enabled) list.push({ label: 'Recargo nocturno', from: onOff(a.night.enabled), to: onOff(b.night.enabled) });
    if (a.night.amount !== b.night.amount) list.push({ label: 'Recargo nocturno · valor', from: cop(a.night.amount), to: cop(b.night.amount) });
    if (a.night.from !== b.night.from || a.night.to !== b.night.to) list.push({ label: 'Recargo nocturno · horario', from: `${a.night.from}–${a.night.to}`, to: `${b.night.from}–${b.night.to}` });
    if (a.airport.enabled !== b.airport.enabled) list.push({ label: 'Recargo de aeropuerto', from: onOff(a.airport.enabled), to: onOff(b.airport.enabled) });
    if (a.airport.pickup !== b.airport.pickup) list.push({ label: 'Aeropuerto · recoger', from: cop(a.airport.pickup), to: cop(b.airport.pickup) });
    if (a.airport.dropoff !== b.airport.dropoff) list.push({ label: 'Aeropuerto · dejar', from: cop(a.airport.dropoff), to: cop(b.airport.dropoff) });
    if (a.airport.radiusM !== b.airport.radiusM) list.push({ label: 'Aeropuerto · radio', from: `${num(a.airport.radiusM)} m`, to: `${num(b.airport.radiusM)} m` });
    return list;
  }, [draft, pricing, code]);
  // Tells the sidebar's country switch there's an unpublished pricing draft.
  useEffect(() => {
    setUnsaved('pricing', changes.length > 0);
    return () => setUnsaved('pricing', false);
  }, [changes.length]);

  const set = <K extends keyof PricingConfig>(k: K, v: PricingConfig[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setCatField = (id: CategoryId, patch: Partial<CategoryPricing>) =>
    setDraft((d) => ({ ...d, categories: { ...d.categories, [id]: { ...d.categories[id], ...patch } } }));

  // Live simulation
  const trip = { distanceKm: distance, durationMin: duration };
  const simNext = calculateFare(trip, draft, cat);
  const simNow = calculateFare(trip, pricing, cat);
  // Base volume: real completed trips of the last 30 days, or an editable assumption.
  const { rows: realTrips } = useAdminTrips();
  const real30 = (realTrips ?? []).filter((t) => t.status === 'completed' && Date.now() - new Date(t.completed_at ?? t.requested_at).getTime() < 30 * 86_400_000).length;
  const [assumed, setAssumed] = useState(1000);
  const monthTrips = real30 > 0 ? real30 : assumed;
  const proj = useMemo(() => projectMonth(pricing, draft, monthTrips), [pricing, draft, monthTrips]);

  const form = (
    <View style={{ gap: space[5] }}>
      <Panel title="Tarifa base del servicio" subtitle="Aplica a NÜVA Go. Las demás categorías usan un multiplicador sobre distancia y tiempo.">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
          <NumberField label="Tarifa base" money value={draft.baseFare} published={pricing.baseFare} step={step(100, 25)} onChange={(v) => set('baseFare', v)} error={errors.baseFare} hint="Banderazo al iniciar el viaje" />
          <NumberField label="Precio por kilómetro" money value={draft.pricePerKm} published={pricing.pricePerKm} step={step(50, 10)} onChange={(v) => set('pricePerKm', v)} error={errors.pricePerKm} />
          <NumberField label="Precio por minuto" money value={draft.pricePerMinute} published={pricing.pricePerMinute} step={step(10, 5)} onChange={(v) => set('pricePerMinute', v)} error={errors.pricePerMinute} />
          <NumberField label="Tarifa mínima" money value={draft.minimumFare} published={pricing.minimumFare} step={step(500, 50)} onChange={(v) => set('minimumFare', v)} error={errors.minimumFare} hint="Ningún viaje cuesta menos que esto" />
        </View>
      </Panel>

      <Panel title="Comisión de la plataforma" subtitle="Porcentaje de cada tarifa que retiene NÜVA. El conductor ve su neto antes de aceptar.">
        <Row style={{ gap: space[5], flexWrap: 'wrap' }}>
          <View style={{ flexGrow: 1, flexBasis: 240 }}>
            <View style={{ flexDirection: 'row' }}>
              <NumberField label="Comisión" suffix="%" value={draft.commissionPct} published={pricing.commissionPct} step={0.5} decimals={1} onChange={(v) => set('commissionPct', v)} error={errors.commissionPct} />
            </View>
            <View style={{ marginTop: space[3] }}>
              <Slider label="Comisión" value={draft.commissionPct} min={0} max={30} step={0.5} onChange={(v) => set('commissionPct', v)} format={(v) => pct(v, 1)} />
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="caption" color={colors.inkMuted}>
                  0 %
                </Txt>
                <Txt v="caption" color={colors.inkMuted}>
                  15 %
                </Txt>
                <Txt v="caption" color={colors.inkMuted}>
                  30 %
                </Txt>
              </Row>
            </View>
          </View>
          <View style={{ flexGrow: 1, flexBasis: 220, padding: space[4], borderRadius: radius.lg, backgroundColor: colors.ivory100, gap: 6 }}>
            <Txt v="caption" color={colors.inkMuted}>
              En un viaje promedio de {cop(proj.next.averageFare)}
            </Txt>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="small">Conductor recibe</Txt>
              <Txt v="title" tabular>
                {cop(proj.next.averageDriver)}
              </Txt>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="small">NÜVA retiene</Txt>
              <Txt v="title" tabular>
                {cop(proj.next.averageFare - proj.next.averageDriver)}
              </Txt>
            </Row>
          </View>
        </Row>
      </Panel>

      <Panel title="Precios por categoría" subtitle="Multiplicador, mínima y comisión propias (vacío = comisión global). El conductor ve su neto con la comisión de su categoría." padded={false}>
        {errors.categories ? (
          <Txt v="caption" color={colors.dangerInk} style={{ paddingHorizontal: space[5], paddingTop: space[3] }}>
            {errors.categories}
          </Txt>
        ) : null}
        <DataTable
          rows={CATEGORY_ORDER.map((id) => draft.categories[id])}
          keyOf={(c) => c.id}
          columns={[
            {
              key: 'name',
              label: 'Categoría',
              flex: 1.4,
              render: (c) => {
                const Icon = CAT_ICON[c.id];
                return (
                  <Row style={{ gap: 10 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.enabled ? colors.midnight : colors.ivory200, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={16}color={c.enabled ? colors.lime : colors.inkMuted} />
                    </View>
                    <View>
                      <Txt v="bodyStrong">NÜVA {c.name}</Txt>
                      <Txt v="caption" color={colors.inkMuted}>
                        {c.seats} {c.seats === 1 ? 'puesto' : 'puestos'}
                      </Txt>
                    </View>
                  </Row>
                );
              },
            },
            { key: 'mult', label: 'Multiplicador', render: (c) => <SmallInput label={`Multiplicador ${c.name}`} value={c.multiplier} decimals={2} prefix="×" onChange={(v) => setCatField(c.id, { multiplier: v })} /> },
            { key: 'min', label: 'Mínima', render: (c) => <SmallInput label={`Tarifa mínima ${c.name}`} value={c.minimumFare} money width={110} onChange={(v) => setCatField(c.id, { minimumFare: v })} /> },
            {
              key: 'com',
              label: 'Comisión',
              render: (c) => (
                // Empty = uses the global commission; any value = this category's own %.
                <Row style={{ gap: 6 }}>
                  <SmallInput
                    label={`Comisión ${c.name}`}
                    value={c.commissionPct ?? draft.commissionPct}
                    decimals={1}
                    width={84}
                    onChange={(v) => setCatField(c.id, { commissionPct: v === draft.commissionPct ? null : v })}
                  />
                  <Txt v="caption" color={c.commissionPct == null ? colors.inkMuted : colors.limeInk}>
                    {c.commissionPct == null ? 'global' : 'propia'}
                  </Txt>
                </Row>
              ),
            },
            {
              key: 'sample',
              label: '5 km · 15 min',
              align: 'right',
              render: (c) => (
                <Txt v="bodyStrong" tabular color={c.enabled ? colors.ink : colors.inkMuted}>
                  {cop(calculateFare({ distanceKm: 5, durationMin: 15 }, draft, c.id).finalFare)}
                </Txt>
              ),
            },
            {
              key: 'on',
              label: 'Activa',
              width: 80,
              align: 'right',
              render: (c) => (
                <Switch
                  value={c.enabled}
                  onValueChange={(v) => setCatField(c.id, { enabled: v })}
                  trackColor={{ true: colors.midnight, false: colors.ivory300 }}
                  thumbColor={c.enabled ? colors.lime : colors.white}
                  accessibilityLabel={`Activar NÜVA ${c.name}`}
                />
              ),
            },
          ]}
        />
      </Panel>

      <WalletRules />
    </View>
  );

  const simulator = (
    <View style={{ gap: space[5] }}>
      <SurchargesPanel
        value={draft.surcharges ?? pricing.surcharges ?? defaultSurchargesFor(code)}
        published={pricing.surcharges ?? defaultSurchargesFor(code)}
        onChange={(v) => set('surcharges', v)}
        error={errors.surcharges}
      />

      <Panel title="Simulador de tarifa" subtitle="Se actualiza con cada cambio, antes de publicar." right={<Badge label="En vivo" tone="lime" dot />}>
        <Row style={{ flexWrap: 'wrap', gap: 6, marginBottom: space[4] }}>
          {PRESETS[code].map((p) => (
            <Chip
              key={p.label}
              label={p.label}
              active={distance === p.d && duration === p.t}
              onPress={() => {
                setDistance(p.d);
                setDuration(p.t);
              }}
            />
          ))}
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="smallStrong">Distancia</Txt>
          <Txt v="smallStrong" tabular>
            {km(distance)}
          </Txt>
        </Row>
        <Slider label="Distancia del viaje" value={distance} min={0.5} max={30} step={0.1} onChange={setDistance} format={km} />
        <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <Txt v="smallStrong">Duración</Txt>
          <Txt v="smallStrong" tabular>
            {minutes(duration)}
          </Txt>
        </Row>
        <Slider label="Duración del viaje" value={duration} min={1} max={90} step={1} onChange={setDuration} format={minutes} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space[3] }}>
          <Segmented
            value={cat}
            onChange={setCat}
            style={{ minWidth: 380 }}
            options={CATEGORY_ORDER.map((id) => ({ value: id, label: draft.categories[id].name }))}
          />
        </ScrollView>

        <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: space[5], padding: 14, borderRadius: radius.md, backgroundColor: colors.ivory100 }}>
          <View>
            <Txt v="caption" color={colors.inkMuted}>
              Publicada (v{pricingVersion})
            </Txt>
            <Txt v="title" tabular color={colors.inkSoft}>
              {cop(simNow.finalFare)}
            </Txt>
          </View>
          <ArrowRight size={18} color={colors.inkMuted} />
          <View style={{ alignItems: 'flex-end' }}>
            <Txt v="caption" color={colors.inkMuted}>
              Con tus cambios
            </Txt>
            <Row style={{ gap: 8 }}>
              <Delta value={simNext.finalFare - simNow.finalFare} invert />
              <Txt v="title" tabular>
                {cop(simNext.finalFare)}
              </Txt>
            </Row>
          </View>
        </Row>
        <View style={{ marginTop: space[4] }}>
          <FareBreakdownCard fare={simNext} config={draft} compact />
        </View>
      </Panel>

      <Panel tone="dark" title="Simulador de ingresos" subtitle={real30 > 0 ? `Proyección mensual · ${num(monthTrips)} viajes reales (30 días)` : 'Proyección mensual · volumen supuesto'}>
        <View style={{ gap: 12 }}>
          {real30 === 0 ? (
            <Field tone="dark" label="Viajes al mes (supuesto)" value={num(assumed)} onChangeText={(t) => setAssumed(Math.max(0, parseInteger(t)))} keyboardType="number-pad" />
          ) : null}
          {[
            { label: 'Volumen transaccionado', a: proj.current.volume, b: proj.next.volume },
            { label: 'Comisión bruta NÜVA', a: proj.current.commission, b: proj.next.commission, strong: true },
            { label: 'Ingresos de conductores', a: proj.current.driver, b: proj.next.driver },
            { label: 'Tarifa promedio', a: proj.current.averageFare, b: proj.next.averageFare, small: true },
          ].map((r) => {
            const d = r.b - r.a;
            return (
              <View key={r.label} style={{ paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.lineDark }}>
                <Txt v="caption" color={colors.onDarkMuted}>
                  {r.label}
                </Txt>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
                  {r.strong ? (
                    <Money value={copCompact(r.b)} size={30} color={colors.lime} />
                  ) : (
                    <Txt v="h3" tabular color={colors.ivory}>
                      {r.small ? cop(r.b) : copCompact(r.b)}
                    </Txt>
                  )}
                  <Row style={{ gap: 4 }}>
                    {d ? (d > 0 ? <TrendingUp size={14} color={colors.lime} /> : <TrendingDown size={14} color={colors.danger} />) : null}
                    <Txt v="smallStrong" tabular color={d > 0 ? colors.lime : d < 0 ? colors.danger : colors.onDarkMuted}>
                      {d ? (r.small ? copDelta(d) : `${d > 0 ? '+' : '−'}${copCompact(Math.abs(d))}`) : 'sin cambio'}
                    </Txt>
                  </Row>
                </Row>
              </View>
            );
          })}
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="caption" color={colors.onDarkMuted}>
              Viajes proyectados
            </Txt>
            <Txt v="smallStrong" tabular color={colors.ivory}>
              {num(proj.next.trips)} ({proj.demand >= 1 ? '+' : '−'}
              {decimal(Math.abs(proj.demand - 1) * 100, 1)} %)
            </Txt>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="caption" color={colors.onDarkMuted}>
              Viajes que pagan tarifa mínima
            </Txt>
            <Txt v="smallStrong" tabular color={colors.ivory}>
              {decimal(proj.next.minimumShare * 100, 1)} %
            </Txt>
          </Row>
          <Row style={{ gap: 8, alignItems: 'flex-start', marginTop: 4 }}>
            <Info size={14} color={colors.onDarkFaint} style={{ marginTop: 2 }} />
            <Txt v="caption" color={colors.onDarkFaint} style={{ flex: 1 }}>
              Supuesto: elasticidad de demanda −0,35 frente al cambio en tarifa promedio. La tarifa promedio se estima con 600 rutas urbanas típicas (modelo, no datos reales).
            </Txt>
          </Row>
        </View>
      </Panel>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: wide ? space[10] : space[4], paddingBottom: 120, maxWidth: 1440, width: '100%', alignSelf: 'center' }}>
      <CountryTariffTabs dirty={changes.length > 0} />
      <PageHead
        kicker={`${country.name} · ${country.currency} · versión publicada v${pricingVersion}`}
        title={`Tarifas y comisión · ${country.name}`}
        subtitle={`Estos valores solo aplican a los viajes en ${country.name}. Cada país tiene sus propias tarifas, comisión y reglas de billetera.`}
        right={
          <>
            {changes.length ? <Badge label={`${changes.length} ${changes.length === 1 ? 'cambio' : 'cambios'} sin publicar`} tone="warning" dot /> : <Badge label="Todo publicado" tone="success" dot />}
            <Button label="Restablecer" icon={RotateCcw} variant="outline" size="md" full={false} disabled={!changes.length} onPress={() => setDraft(pricing)} />
            <Button label="Publicar cambios" icon={Send} size="md" full={false} disabled={!changes.length || hasErrors}
              onPress={() => {
                setPending(changes);
                setPendingImpact(proj.next.commission - proj.current.commission);
                setConfirm(true);
              }}
            />
          </>
        }
      />

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[5], alignItems: 'flex-start' }}>
        <View style={{ flex: wide ? 1.2 : undefined, width: wide ? undefined : '100%' }}>{form}</View>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%' }}>{simulator}</View>
      </View>

      <Row style={{ marginTop: space[6], gap: 10 }}>
        <Button
          label="Volver a los valores de lanzamiento"
          variant="ghost"
          size="sm"
          full={false}
          onPress={() => {
            setDraft(defaultPricingFor(code));
            toast('Borrador con valores de lanzamiento. Publica para aplicarlos', 'info');
          }}
        />
      </Row>

      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => setConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: space[4] }}>
          <Animated.View entering={FadeInDown.springify().damping(18)} style={{ width: '100%', maxWidth: 520, backgroundColor: colors.white, borderRadius: radius.xl, padding: space[6] }}>
            <Txt v="h2">¿Publicar nuevas tarifas de {country.name}?</Txt>
            <Txt v="body" color={colors.inkMuted} style={{ marginTop: 6 }}>
              Se aplican de inmediato a nuevas cotizaciones en {country.name}. Las tarifas de los demás países no cambian. Los viajes en curso conservan su precio.
            </Txt>
            <View style={{ marginTop: space[5], borderRadius: radius.md, backgroundColor: colors.ivory100, padding: space[4] }}>
              {pending.map((c, i) => (
                <View key={c.label}>
                  {i ? <Divider style={{ marginVertical: 8 }} /> : null}
                  <Row style={{ justifyContent: 'space-between', gap: 10 }}>
                    <Txt v="smallStrong" style={{ flex: 1 }}>
                      {c.label}
                    </Txt>
                    <Txt v="small" color={colors.inkMuted} tabular style={{ textDecorationLine: 'line-through' }}>
                      {c.from}
                    </Txt>
                    <ArrowRight size={14} color={colors.inkMuted} />
                    <Txt v="smallStrong" tabular>
                      {c.to}
                    </Txt>
                  </Row>
                </View>
              ))}
            </View>
            <Row style={{ justifyContent: 'space-between', marginTop: space[4] }}>
              <Txt v="small" color={colors.inkMuted}>
                Impacto mensual en comisión
              </Txt>
              <Delta value={pendingImpact} />
            </Row>
            <Row style={{ gap: 10, marginTop: space[6] }}>
              <Button label="Seguir editando" variant="outline" size="md" full={false} style={{ flex: 1 }} onPress={() => setConfirm(false)} />
              <Button
                label="Publicar ahora"
                icon={Send}
                variant="dark"
                size="md"
                full={false}
                style={{ flex: 1 }}
                loading={publishing}
                onPress={async () => {
                  setPublishing(true);
                  try {
                    const v = await publishPricing(draft);
                    setConfirm(false);
                    toast(`Tarifas de ${country.name} publicadas · v${v}. Ya aplican en las apps`);
                  } catch (e) {
                    toast(e instanceof Error ? e.message : 'No se pudo publicar', 'warning');
                  } finally {
                    setPublishing(false);
                  }
                }}
              />
            </Row>
          </Animated.View>
        </View>
      </Modal>
    </ScrollView>
  );
}
