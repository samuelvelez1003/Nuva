import React from 'react';
import { Image, View } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { Txt } from '../ui/Txt';
import { colors, radius } from '../../theme/tokens';

/** Review states of a driver's identity selfie. */
export const SELFIE_STATUS = {
  pendiente: { l: 'Por revisar', t: 'warning' as const },
  aprobada: { l: 'Aprobada', t: 'success' as const },
  rechazada: { l: 'Rechazada', t: 'danger' as const },
};

/** A square photo with a caption, or a placeholder when there's none (no profile photo, expired link…). */
export function Photo({ uri, label, size = 150 }: { uri?: string | null; label: string; size?: number }) {
  return (
    <View style={{ gap: 6, alignItems: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.ivory200, alignItems: 'center', justifyContent: 'center' }}>
        {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={label} /> : <UserRound size={size / 4} color={colors.stone} />}
      </View>
      <Txt v="caption" color={colors.inkMuted} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}
