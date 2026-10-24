import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Car, Check, House, Search, ShieldCheck, Star } from 'lucide-react-native';
import { useWide } from '../components/admin/AdminKit';
import { AppIcon, RouteGlyph, Wordmark } from '../components/brand/Brand';
import { Button, IconButton } from '../components/ui/Button';
import { OnlineToggle } from '../components/ui/OnlineToggle';
import { Avatar, Badge, Card, Chip, Field, ListRow, ProgressBar, Row, Segmented, Skeleton, Stars } from '../components/ui/primitives';
import { useStatusTone } from '../components/ui/Screen';
import { Money, Txt } from '../components/ui/Txt';
import { colors, palette, radius, space, type, TypeVariant } from '../theme/tokens';

const SWATCHES: { name: string; hex: string; role: string; dark?: boolean }[] = [
  { name: 'Tinta', hex: palette.midnight, role: 'Títulos, texto, botón oscuro y superficies del conductor', dark: true },
  { name: 'Turquesa', hex: palette.lime, role: 'Acción principal (texto blanco), estado activo, la ruta en el mapa', dark: true },
  { name: 'Violeta', hex: colors.violet, role: 'Acento secundario: el destino, puntos gráficos', dark: true },
  { name: 'Niebla', hex: palette.ivory, role: 'Fondo de la app y de la web' },
  { name: 'Menta suave', hex: colors.limeSoft, role: 'Chips positivos e íconos turquesa' },
  { name: 'Blanco', hex: palette.white, role: 'Tarjetas y hojas sobre la aurora y el mapa' },
];

function Section({ n, title, children, dark }: { n: string; title: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <View style={{ paddingVertical: space[10], borderTopWidth: 1, borderTopColor: dark ? colors.lineDark : colors.lineLight }}>
      <Row style={{ gap: 14, marginBottom: space[6], alignItems: 'baseline' }}>
        <Txt v="overline" color={dark ? colors.limeOnDark : colors.limeInk}>
          {n}
        </Txt>
        <Txt v="h1" color={dark ? colors.ivory : colors.midnight}>
          {title}
        </Txt>
      </Row>
      {children}
    </View>
  );
}

export default function DesignSystem() {
  const insets = useSafeAreaInsets();
  const wide = useWide(900);
  const [online, setOnline] = useState(true);
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  useStatusTone('dark');
  const pad = wide ? 72 : space[5];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ivory100 }} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
      <View style={{ backgroundColor: colors.midnight, paddingTop: insets.top + space[5], paddingHorizontal: pad, paddingBottom: space[12] }}>
        <Row style={{ gap: 12 }}>
          <IconButton icon={ArrowLeft} label="Volver" tone="dark" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <Txt v="smallStrong" color={colors.onDarkMuted}>
            Sistema de diseño · v3.0 · Aurora
          </Txt>
        </Row>
        <View style={{ marginTop: space[10], flexDirection: wide ? 'row' : 'column', gap: space[8], alignItems: wide ? 'flex-end' : 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ maxWidth: 640 }}>
            <Wordmark height={wide ? 72 : 52} color={colors.ivory} />
            <Txt v="body" color={colors.onDarkMuted} style={{ marginTop: space[6], fontSize: 17, lineHeight: 26 }}>
              Ligera y luminosa. Fondo niebla con auroras suaves (menta, violeta, cian), tarjetas blancas, tinta para lo importante, turquesa para la acción principal y violeta para el destino.
            </Txt>
          </View>
          <Row style={{ gap: 14 }}>
            <AppIcon size={wide ? 120 : 84} />
            <AppIcon size={wide ? 120 : 84} variant="lime" />
            <AppIcon size={wide ? 120 : 84} variant="ivory" />
          </Row>
        </View>
      </View>

      <View style={{ paddingHorizontal: pad }}>
        <Section n="01" title="Marca">
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[5] }}>
            <Card style={{ flex: 1, gap: space[4] }}>
              <Txt v="title">El cuadrado violeta es el destino</Txt>
              <Row style={{ gap: 14 }}>
                <RouteGlyph height={56} />
                <Txt v="body" color={colors.inkSoft} style={{ flex: 1 }}>
                  Origen: un anillo de tinta. Destino: un cuadrado violeta. En el mapa la ruta va en turquesa sobre calles blancas y un suelo gris frío.
                </Txt>
              </Row>
            </Card>
            <Card style={{ flex: 1, gap: space[4] }}>
              <Txt v="title">NÜVA en Sora, con aire</Txt>
              <Txt v="body" color={colors.inkSoft}>
                El logo es la palabra NÜVA en Sora Bold con espaciado abierto. El ícono es la N de tinta sobre un cuadro de aurora.
              </Txt>
              <Wordmark height={36} />
            </Card>
            <Card tone="lime" style={{ flex: 1, gap: space[4] }}>
              <Txt v="title" color={colors.onLime}>
                Tu ciudad. Tu ritmo. Tu precio.
              </Txt>
              <Txt v="body" color={colors.onLime}>
                Voz cercana, colombiana, directa. Tuteamos. Decimos “trancón”, no “congestión vehicular”.
              </Txt>
            </Card>
          </View>
        </Section>

        <Section n="02" title="Color">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
            {SWATCHES.map((s) => (
              <View key={s.name} style={{ flexGrow: 1, flexBasis: 200, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.lineLight, backgroundColor: colors.white }}>
                <View style={{ height: 120, backgroundColor: s.hex, padding: 14, justifyContent: 'flex-end' }}>
                  <Txt v="smallStrong" color={s.dark ? colors.white : colors.ink}>
                    {s.hex}
                  </Txt>
                </View>
                <View style={{ padding: 14 }}>
                  <Txt v="title">{s.name}</Txt>
                  <Txt v="caption" color={colors.inkMuted}>
                    {s.role}
                  </Txt>
                </View>
              </View>
            ))}
          </View>
          <Txt v="small" color={colors.inkMuted} style={{ marginTop: space[4] }}>
            Contraste: texto secundario #4E5D66 (AA sobre niebla y blanco). Sobre turquesa el texto siempre es blanco (5,0:1); el turquesa como texto pequeño usa #0B5F59 sobre claro y menta #7BE0C4 sobre tinta. Las auroras son solo decoración: el texto va sobre el fondo o sobre tarjetas blancas.
          </Txt>
        </Section>

        <Section n="03" title="Tipografía · Sora">
          {(['hero', 'display', 'h1', 'h2', 'h3', 'title', 'body', 'small', 'caption', 'overline'] as TypeVariant[]).map((v) => (
            <Row key={v} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.lineLight, gap: 20 }}>
              <Txt v="caption" color={colors.inkMuted} style={{ width: 120 }}>
                {v} · {type[v].fontSize}/{type[v].lineHeight}
              </Txt>
              <Txt v={v} style={{ flex: 1 }} numberOfLines={1}>
                {v === 'overline' ? 'Ganancia neta de hoy' : '¿A dónde vamos?'}
              </Txt>
            </Row>
          ))}
          <Row style={{ gap: space[8], marginTop: space[6], flexWrap: 'wrap' }}>
            <View>
              <Txt v="caption" color={colors.inkMuted}>
                Dinero (cifras tabulares, signo elevado)
              </Txt>
              <Money value="$12.496" size={56} />
            </View>
            <View style={{ backgroundColor: colors.midnight, padding: space[5], borderRadius: radius.lg }}>
              <Txt v="caption" color={colors.onDarkMuted}>
                Ganancia del conductor
              </Txt>
              <Money value="$109.728" size={48} color={colors.ivory} signColor={colors.limeOnDark} />
            </View>
          </Row>
        </Section>

        <Section n="04" title="Componentes">
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[5] }}>
            <Card style={{ flex: 1, gap: space[3] }}>
              <Txt v="overline" color={colors.inkMuted}>
                Botones
              </Txt>
              <Button
                label="Pedir Go"
                trailing={
                  <Txt v="title" color={colors.onLime}>
                    $6.700
                  </Txt>
                }
              />
              <Button label="Confirmar recogida" variant="dark" />
              <Row style={{ gap: 8 }}>
                <Button label="Secundario" variant="outline" size="md" full={false} />
                <Button label="SOS" variant="danger" size="md" full={false} icon={ShieldCheck} />
              </Row>
              <Row style={{ gap: 8 }}>
                <IconButton icon={House} label="Casa" />
                <IconButton icon={Search} label="Buscar" tone="dark" />
                <IconButton icon={Check} label="Listo" tone="lime" />
              </Row>
            </Card>
            <Card style={{ flex: 1, gap: space[3] }}>
              <Txt v="overline" color={colors.inkMuted}>
                Selección y estado
              </Txt>
              <Segmented value={seg} onChange={setSeg} options={[{ value: 'a', label: 'Día' }, { value: 'b', label: 'Semana' }, { value: 'c', label: 'Mes' }]} />
              <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                <Chip label="Puntual" active />
                <Chip label="Buena música" />
                <Badge label="Tarifa mínima" />
                <Badge label="Aprobado" tone="success" dot />
                <Badge label="Por vencer" tone="warning" />
              </Row>
              <ProgressBar value={0.68} />
              <Row style={{ gap: 10 }}>
                <Avatar initials="VR" bg={colors.midnight} fg={colors.ivory} />
                <Stars value={4.9} />
              </Row>
              <Field label="Tarifa base" prefix="$" value="2.000" onChangeText={() => {}} />
            </Card>
            <Card style={{ flex: 1, gap: space[3] }}>
              <Txt v="overline" color={colors.inkMuted}>
                Listas y carga
              </Txt>
              <ListRow icon={Car} title="Mi vehículo" subtitle="Mazda 2 · LUV 715" onPress={() => {}} />
              <ListRow icon={Star} title="Calificaciones" subtitle="4,94 · 1.268 opiniones" onPress={() => {}} />
              <Skeleton w="100%" h={16} />
              <Skeleton w="70%" h={16} />
              <Skeleton w="40%" h={16} />
            </Card>
          </View>
          <View style={{ marginTop: space[5], backgroundColor: colors.midnight, padding: space[5], borderRadius: radius.xl }}>
            <Txt v="overline" color={colors.onDarkMuted} style={{ marginBottom: space[3] }}>
              Control principal del conductor
            </Txt>
            <OnlineToggle online={online} onChange={setOnline} />
          </View>
        </Section>

        <Section n="05" title="Espaciado y forma">
          <Row style={{ gap: space[3], flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {[4, 8, 12, 16, 20, 24, 32, 40, 48, 64].map((s) => (
              <View key={s} style={{ alignItems: 'center', gap: 6 }}>
                <View style={{ width: s, height: s, backgroundColor: colors.midnight, borderRadius: 3 }} />
                <Txt v="caption" color={colors.inkMuted}>
                  {s}
                </Txt>
              </View>
            ))}
          </Row>
          <Row style={{ gap: space[3], marginTop: space[6], flexWrap: 'wrap' }}>
            {Object.entries(radius).filter(([k]) => k !== 'pill').map(([k, r]) => (
              <View key={k} style={{ alignItems: 'center', gap: 6 }}>
                <View style={{ width: 72, height: 72, borderRadius: r, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.midnight }} />
                <Txt v="caption" color={colors.inkMuted}>
                  {k} · {r}
                </Txt>
              </View>
            ))}
          </Row>
          <Txt v="small" color={colors.inkMuted} style={{ marginTop: space[6] }}>
            Movimiento: 160 / 260 / 420 ms, resortes con damping 18. Los botones se comprimen al 97 %; las hojas entran desde abajo; el vidrio solo flota sobre el mapa. Sombras suaves de tinta (rgba(14,27,36,0.07)); las auroras derivan despacio en la web.
          </Txt>
        </Section>
      </View>
    </ScrollView>
  );
}
