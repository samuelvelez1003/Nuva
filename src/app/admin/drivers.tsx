import React from 'react';
import { ScrollView } from 'react-native';
import { PageHead, useWide } from '../../components/admin/AdminKit';
import { RealDrivers } from '../../components/admin/RealDrivers';
import { useCountry } from '../../lib/country';
import { cop } from '../../lib/format';
import { useNuvaSettings } from '../../lib/settings';
import { space } from '../../theme/tokens';

/** Drivers registered on the server: review, approve, suspend. */
export default function DriverManagement() {
  const wide = useWide(1180);
  const { country } = useCountry();
  // The welcome bonus is set per country in Tarifas → Billetera (0 = no bonus).
  const { settings } = useNuvaSettings();
  const bonus = settings.welcomeBonus > 0 ? ` y recibe ${cop(settings.welcomeBonus)} de bono en su saldo NÜVA` : '';
  return (
    <ScrollView contentContainerStyle={{ padding: wide ? space[10] : space[4], paddingBottom: 120, maxWidth: 1440, width: '100%', alignSelf: 'center' }}>
      <PageHead
        kicker={`Gestión · ${country.name}`}
        title="Conductores"
        subtitle={`Al aprobar a un conductor puede empezar a recibir viajes${bonus}. Las recargas manuales (efectivo, transferencia) se registran desde «Ajustar» en su saldo.`}
      />
      <RealDrivers />
    </ScrollView>
  );
}
