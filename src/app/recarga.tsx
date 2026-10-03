import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Wallet } from 'lucide-react-native';
import { Wordmark } from '../components/brand/Brand';
import { Button } from '../components/ui/Button';
import { useStatusTone } from '../components/ui/Screen';
import { Txt } from '../components/ui/Txt';
import { colors, space } from '../theme/tokens';

/** Wompi sends drivers here after paying a top-up. The webhook credits the balance. */
export default function TopupReturn() {
  useStatusTone('light');
  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[5] }}>
      <Wordmark height={28} color={colors.ivory} />
      <View style={{ width: 88, height: 88, borderRadius: 30, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginTop: space[6] }}>
        <Wallet size={40} color={colors.midnight} />
      </View>
      <Txt v="h1" align="center" color={colors.ivory}>
        Recibimos tu recarga
      </Txt>
      <Txt v="body" align="center" color={colors.onDarkMuted} style={{ maxWidth: 360 }}>
        Si el pago fue aprobado, tu saldo NÜVA se actualiza en unos segundos. Vuelve a la app de conductor para verlo.
      </Txt>
      <Button label="Volver a NÜVA" full={false} onPress={() => router.replace('/')} style={{ marginTop: space[4] }} />
    </View>
  );
}
