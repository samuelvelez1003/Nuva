import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { Wordmark } from '../components/brand/Brand';
import { Button } from '../components/ui/Button';
import { useStatusTone } from '../components/ui/Screen';
import { Txt } from '../components/ui/Txt';
import { colors, space } from '../theme/tokens';

/** Landing page for the e-mail confirmation link. */
export default function Verified() {
  useStatusTone('light');
  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[5] }}>
      <Wordmark height={28} color={colors.ivory} />
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginTop: space[6] }}>
        <CheckCircle2 size={44} color={colors.midnight} />
      </View>
      <Txt v="h1" align="center" color={colors.ivory}>
        ¡Correo confirmado!
      </Txt>
      <Txt v="body" align="center" color={colors.onDarkMuted} style={{ maxWidth: 360 }}>
        Vuelve a la app de NÜVA e inicia sesión con tu correo y contraseña.
      </Txt>
      <Button label="Ir a NÜVA" full={false} onPress={() => router.replace('/')} style={{ marginTop: space[4] }} />
    </View>
  );
}
