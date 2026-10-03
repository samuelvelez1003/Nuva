import React, { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { MapPin, Plus, Trash2 } from 'lucide-react-native';
import { PageHead, Panel, Slider, useWide } from '../../components/admin/AdminKit';
import { CityMap } from '../../components/map/CityMap';
import { Button, IconButton } from '../../components/ui/Button';
import { Badge, Chip, EmptyState, Field, Row } from '../../components/ui/primitives';
import { useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { AREA_LABELS } from '../../data/places';
import { useAdminTrips, useZones, ZoneRow } from '../../lib/adminData';
import { decimal, num } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { activeCountry } from '../../lib/region';
import { colors, space } from '../../theme/tokens';

const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const within = (z: ZoneRow, p: { lat: number; lng: number }) => Math.hypot((p.lat - z.center.lat) * 110574, (p.lng - z.center.lng) * 110954) <= z.radius_m;

/** Service zones stored on the server. Trip counts are real pickups inside each zone. */
export default function ServiceZones() {
  const wide = useWide(1180);
  const toast = useToast();
  const { rows: zones, refresh } = useZones();
  const { rows: trips } = useAdminTrips();
  const [name, setName] = useState('');
  const [area, setArea] = useState(AREA_LABELS[0]);
  const [radius, setRadius] = useState(2000);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.from('zones').insert({ name: name.trim() || titleCase(area.name), status: 'activa', center: { lat: area.lat, lng: area.lng }, radius_m: radius, country: activeCountry() });
    setSaving(false);
    if (error) return toast(error.message, 'warning');
    toast('Zona creada');
    setName('');
    refresh();
  };

  const setStatus = async (z: ZoneRow, on: boolean) => {
    const { error } = await supabase!.from('zones').update({ status: on ? 'activa' : 'pausada' }).eq('id', z.id);
    if (error) return toast(error.message, 'warning');
    refresh();
  };

  const remove = async (z: ZoneRow) => {
    const { error } = await supabase!.from('zones').delete().eq('id', z.id);
    if (error) return toast(error.message, 'warning');
    toast('Zona eliminada', 'info');
    refresh();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: wide ? space[10] : space[4], paddingBottom: 120, maxWidth: 1440, width: '100%', alignSelf: 'center' }}>
      <PageHead kicker="Cobertura" title="Zonas de servicio" subtitle="Define dónde opera NÜVA. Los viajes se cuentan por punto de recogida dentro de cada zona." />
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[5] }}>
        <Panel padded={false} style={{ flex: wide ? 1.2 : undefined, overflow: 'hidden' }}>
          <View style={{ height: wide ? 560 : 340 }}>
            <CityMap
              theme="dark"
              focus={[{ lat: 4.725, lng: -74.115 }, { lat: 4.592, lng: -74.03 }]}
              insets={{ top: 20, bottom: 20, left: 20, right: 20 }}
              hotspots={[
                ...(zones ?? []).filter((z) => z.status !== 'pausada').map((z) => ({ center: z.center, radius: z.radius_m, intensity: 0.6 })),
                { center: area, radius, intensity: 1 },
              ]}
            />
          </View>
        </Panel>

        <View style={{ flex: wide ? 1 : undefined, gap: space[3] }}>
          <Panel title="Nueva zona" subtitle="Elige el centro y el radio">
            <View style={{ gap: space[4] }}>
              <Row style={{ flexWrap: 'wrap', gap: 6 }}>
                {AREA_LABELS.map((a) => (
                  <Chip key={a.name} label={titleCase(a.name)} active={area.name === a.name} onPress={() => setArea(a)} />
                ))}
              </Row>
              <Field label="Nombre (opcional)" placeholder={titleCase(area.name)} value={name} onChangeText={setName} />
              <View>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt v="smallStrong">Radio</Txt>
                  <Txt v="smallStrong" tabular>
                    {decimal(radius / 1000, 1)} km
                  </Txt>
                </Row>
                <Slider label="Radio de la zona" value={radius} min={500} max={6000} step={100} onChange={setRadius} />
              </View>
              <Button label="Crear zona" icon={Plus} variant="dark" size="md" loading={saving} onPress={create} />
            </View>
          </Panel>

          {zones && zones.length === 0 ? (
            <Panel>
              <EmptyState icon={MapPin} title="Sin zonas configuradas" body="Crea la primera zona donde NÜVA va a operar." />
            </Panel>
          ) : null}
          {(zones ?? []).map((z) => {
            const count = (trips ?? []).filter((t) => within(z, t.pickup)).length;
            return (
              <Panel key={z.id}>
                <Row style={{ gap: 10 }}>
                  <MapPin size={18} color={z.status === 'pausada' ? colors.stone : colors.ink} />
                  <View style={{ flex: 1 }}>
                    <Txt v="title" numberOfLines={1}>
                      {z.name}
                    </Txt>
                    <Txt v="caption" color={colors.inkMuted}>
                      Radio {decimal(z.radius_m / 1000, 1)} km · {num(count)} viajes registrados
                    </Txt>
                  </View>
                  <Badge label={z.status === 'activa' ? 'Activa' : z.status === 'piloto' ? 'Piloto' : 'Pausada'} tone={z.status === 'activa' ? 'success' : z.status === 'piloto' ? 'info' : 'neutral'} />
                  <Switch
                    value={z.status !== 'pausada'}
                    onValueChange={(v) => setStatus(z, v)}
                    trackColor={{ true: colors.midnight, false: colors.ivory300 }}
                    thumbColor={z.status !== 'pausada' ? colors.lime : colors.white}
                    accessibilityLabel={`Activar zona ${z.name}`}
                  />
                  <IconButton icon={Trash2} label={`Eliminar ${z.name}`} tone="clear" size={36} onPress={() => remove(z)} />
                </Row>
              </Panel>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
