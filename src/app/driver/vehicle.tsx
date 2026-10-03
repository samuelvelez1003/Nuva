import React, { useState } from 'react';
import { Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Bike, Car, Check, Zap } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { Badge, Card, Field, Row, SectionHeader, Segmented } from '../../components/ui/primitives';
import { Header, Screen, useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { useT } from '../../i18n';
import { CategoryId } from '../../lib/fare';
import { DriverData } from '../../components/driver/DriverData';
import { useApp } from '../../store/AppStore';
import { useAuth } from '../../store/Auth';
import { colors, fonts, radius, space } from '../../theme/tokens';

const CURRENT_YEAR = new Date().getFullYear();

export default function VehicleRegistration() {
  const { live } = useAuth();
  // A real driver sees their own registered vehicle, never the demo Mazda.
  return live ? <DriverData kind="vehicle" /> : <DemoVehicleRegistration />;
}

/** Demo walkthrough (no backend). */
function DemoVehicleRegistration() {
  const { pricing } = useApp();
  const toast = useToast();
  const t = useT();
  const [kind, setKind] = useState<'car' | 'moto'>('car');
  const [brand, setBrand] = useState('Mazda');
  const [model, setModel] = useState('2 Sedán');
  const [year, setYear] = useState('2023');
  const [color, setColor] = useState('Gris titanio');
  const [plate, setPlate] = useState('LUV715');
  const [seats, setSeats] = useState('4');
  const [electric, setElectric] = useState(false);
  const [touched, setTouched] = useState(false);

  const y = parseInt(year, 10);
  const plateOk = kind === 'car' ? /^[A-Z]{3}\d{3}$/.test(plate) : /^[A-Z]{3}\d{2}[A-Z]$/.test(plate);
  const errors = {
    brand: !brand.trim() ? t('drv.vehicle.errBrand') : undefined,
    model: !model.trim() ? t('drv.vehicle.errModel') : undefined,
    year: !y || y < 2008 || y > CURRENT_YEAR + 1 ? t('drv.vehicle.errYear', { min: 2008, max: CURRENT_YEAR + 1 }) : undefined,
    plate: !plateOk ? t('drv.vehicle.errPlate', { format: kind === 'car' ? 'ABC123' : 'ABC12D' }) : undefined,
  };
  const valid = !Object.values(errors).some(Boolean);

  const eligible: CategoryId[] =
    kind === 'moto'
      ? ['moto']
      : ([
          y >= 2012 ? 'go' : null,
          electric ? 'eco' : null,
          y >= 2019 && !electric ? 'confort' : null,
          parseInt(seats, 10) >= 6 ? 'xl' : null,
        ].filter(Boolean) as CategoryId[]);

  return (
    <Screen
      bg={colors.midnight}
      header={<Header title={t('auth.vehicle.title')} subtitle={t('drv.vehicle.subtitle')} large tone="dark" />}
      footer={
        <Button
          label={t('drv.vehicle.save')}
          disabled={touched && !valid}
          onPress={() => {
            setTouched(true);
            if (!valid) return;
            toast(t('drv.vehicle.saved'));
            router.replace('/driver/documents');
          }}
        />
      }
    >
      <Segmented
        tone="dark"
        value={kind}
        onChange={(k) => {
          setKind(k);
          setPlate(k === 'car' ? 'LUV715' : 'KDT21F');
        }}
        options={[
          { value: 'car', label: t('drv.vehicle.car') },
          { value: 'moto', label: t('drv.vehicle.moto') },
        ]}
      />

      {/* Plate preview */}
      <View style={{ alignItems: 'center', marginVertical: space[6] }}>
        <View style={{ backgroundColor: '#F6CB2F', borderRadius: 10, borderWidth: 3, borderColor: colors.midnight, paddingHorizontal: 22, paddingVertical: 6, alignItems: 'center', minWidth: 190 }}>
          <Txt style={{ fontFamily: fonts.extrabold, fontSize: 38, letterSpacing: 3, lineHeight: 44 }} color={colors.midnight}>
            {plate ? `${plate.slice(0, 3)} ${plate.slice(3)}` : '——— ———'}
          </Txt>
          <Txt style={{ fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2 }} color={colors.midnight}>
            PEREIRA
          </Txt>
        </View>
      </View>

      <View style={{ gap: space[4] }}>
        <Field
          tone="dark"
          label={t('common.plate')}
          value={plate}
          onChangeText={(v) => setPlate(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          autoCapitalize="characters"
          error={touched ? errors.plate : undefined}
        />
        <Row style={{ gap: 12 }}>
          <Field tone="dark" label={t('auth.field.brand')} value={brand} onChangeText={setBrand} style={{ flex: 1 }} error={touched ? errors.brand : undefined} />
          <Field tone="dark" label={t('auth.field.model')} value={model} onChangeText={setModel} style={{ flex: 1 }} error={touched ? errors.model : undefined} />
        </Row>
        <Row style={{ gap: 12 }}>
          <Field
            tone="dark"
            label={t('drv.vehicle.year')}
            value={year}
            onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            style={{ flex: 1 }}
            error={touched ? errors.year : undefined}
          />
          <Field tone="dark" label={t('auth.field.color')} value={color} onChangeText={setColor} style={{ flex: 1.4 }} />
        </Row>
        {kind === 'car' ? (
          <>
            <Field tone="dark" label={t('drv.vehicle.seats')} value={seats} onChangeText={(v) => setSeats(v.replace(/\D/g, '').slice(0, 1))} keyboardType="number-pad" />
            <Row style={{ justifyContent: 'space-between', padding: 16, borderRadius: radius.md, backgroundColor: colors.midnight700 }}>
              <Row style={{ gap: 10, flexShrink: 1 }}>
                <Zap size={18} color={colors.lime} />
                <View style={{ flexShrink: 1 }}>
                  <Txt v="bodyStrong" color={colors.ivory}>
                    {t('drv.vehicle.electricTitle')}
                  </Txt>
                  <Txt v="caption" color={colors.onDarkMuted}>
                    {t('drv.vehicle.electricSub')}
                  </Txt>
                </View>
              </Row>
              <Switch
                value={electric}
                onValueChange={setElectric}
                trackColor={{ true: colors.lime, false: colors.midnight500 }}
                thumbColor={colors.white}
                accessibilityLabel={t('drv.vehicle.electricA11y')}
              />
            </Row>
          </>
        ) : null}
      </View>

      <SectionHeader tone="dark" title={t('drv.vehicle.categoriesTitle')} style={{ marginTop: space[6] }} />
      <Card tone="dark">
        {eligible.length ? (
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            {eligible.map((c) => (
              <Row key={c} style={{ gap: 6, paddingHorizontal: 12, height: 34, borderRadius: radius.pill, backgroundColor: colors.limeDim }}>
                {c === 'moto' ? <Bike size={14} color={colors.lime} /> : <Car size={14} color={colors.lime} />}
                <Txt v="smallStrong" color={colors.lime}>
                  NÜVA {pricing.categories[c].name}
                </Txt>
                <Check size={14} color={colors.lime} />
              </Row>
            ))}
          </Row>
        ) : (
          <Badge label={t('drv.vehicle.tooOld', { year: 2012 })} tone="warning" />
        )}
        <Txt v="caption" color={colors.onDarkMuted} style={{ marginTop: 12 }}>
          {t('drv.vehicle.rules', { year: 2019, seats: 6 })}
        </Txt>
      </Card>
    </Screen>
  );
}
