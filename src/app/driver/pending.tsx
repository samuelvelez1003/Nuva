import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Clock3, LogOut, RefreshCw, ShieldX, UserRound } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { Card, KeyValue } from '../../components/ui/primitives';
import { Header, Screen, useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { useT } from '../../i18n';
import { useAuth } from '../../store/Auth';
import { colors, space } from '../../theme/tokens';

/** Shown while an admin reviews a new driver (or if the account isn't a driver). */
export default function DriverPending() {
  const { profile, refreshProfile, signOut } = useAuth();
  const toast = useToast();
  const t = useT();
  const [loading, setLoading] = useState(false);
  const isPassenger = profile?.role === 'passenger';
  const suspended = profile?.driver_status === 'suspendido';
  const Icon = isPassenger ? UserRound : suspended ? ShieldX : Clock3;

  const check = async () => {
    setLoading(true);
    const p = await refreshProfile();
    setLoading(false);
    if (p?.role === 'admin' || p?.driver_status === 'aprobado') {
      toast(t('drv.pending.approved'));
      router.replace('/driver/home');
    } else toast(t('drv.pending.stillReviewing'), 'info');
  };

  return (
    <Screen bg={colors.midnight} header={<Header tone="dark" back={false} />}>
      <Animated.View entering={FadeIn} style={{ alignItems: 'center', paddingTop: space[8], gap: space[4] }}>
        <View style={{ width: 88, height: 88, borderRadius: 30, backgroundColor: suspended ? colors.danger : colors.lime, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={38} color={suspended ? colors.white : colors.midnight} />
        </View>
        <Txt v="h1" align="center" color={colors.ivory}>
          {isPassenger ? t('drv.pending.passengerTitle') : suspended ? t('drv.pending.suspendedTitle') : t('drv.pending.reviewTitle')}
        </Txt>
        <Txt v="body" align="center" color={colors.onDarkMuted} style={{ maxWidth: 320 }}>
          {isPassenger ? t('drv.pending.passengerBody') : suspended ? t('drv.pending.suspendedBody') : t('drv.pending.reviewBody')}
        </Txt>
      </Animated.View>

      {!isPassenger && profile ? (
        <Card tone="dark" style={{ marginTop: space[8] }}>
          <KeyValue tone="dark" label={t('common.name')} value={profile.full_name || '—'} />
          <KeyValue tone="dark" label={t('common.vehicle')} value={[profile.vehicle?.brand, profile.vehicle?.model].filter(Boolean).join(' ') || '—'} />
          <KeyValue tone="dark" label={t('common.plate')} value={profile.vehicle?.plate ?? '—'} />
          {profile.country === 'CW' ? (
            <>
              <KeyValue tone="dark" label={t('drv.pending.license')} value={profile.vehicle?.license ?? '—'} />
              <KeyValue tone="dark" label={t('drv.pending.insurance')} value={profile.vehicle?.insuranceUntil?.split('-').reverse().join('/') ?? '—'} />
              <KeyValue tone="dark" label={t('drv.pending.bank')} value={profile.payout?.bank ?? '—'} />
            </>
          ) : (
            <KeyValue tone="dark" label={t('drv.pending.nequi')} value={profile.payout?.nequi ?? '—'} />
          )}
        </Card>
      ) : null}

      <View style={{ gap: 10, marginTop: space[6] }}>
        {!isPassenger ? <Button label={t('drv.pending.checkAgain')} icon={RefreshCw} loading={loading} onPress={check} /> : null}
        {!isPassenger ? <Button label={t('drv.pending.seeDocs')} variant="outlineDark" onPress={() => router.push('/driver/documents')} /> : null}
        <Button
          label={t('common.signOut')}
          icon={LogOut}
          variant="outlineDark"
          size="md"
          onPress={async () => {
            await signOut();
            router.replace('/');
          }}
        />
      </View>
    </Screen>
  );
}
