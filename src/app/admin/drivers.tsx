import React from 'react';
import { ScrollView } from 'react-native';
import { PageHead, useWide } from '../../components/admin/AdminKit';
import { RealDrivers } from '../../components/admin/RealDrivers';
import { space } from '../../theme/tokens';

/** Drivers registered on the server: review, approve, suspend. */
export default function DriverManagement() {
  const wide = useWide(1180);
  return (
    <ScrollView contentContainerStyle={{ padding: wide ? space[10] : space[4], paddingBottom: 120, maxWidth: 1440, width: '100%', alignSelf: 'center' }}>
      <PageHead
        kicker="Gestión"
        title="Conductores"
        subtitle="Al aprobar a un conductor recibe $20.000 de bono en su saldo NÜVA y puede empezar a recibir viajes."
      />
      <RealDrivers />
    </ScrollView>
  );
}
