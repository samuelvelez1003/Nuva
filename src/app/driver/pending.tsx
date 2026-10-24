import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Clock3, LogOut, RefreshCw, Scale, Send, ShieldX, UserRound } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { Card, KeyValue, Row } from '../../components/ui/primitives';
import { Header, Screen, useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { MyTickets } from '../../components/support/MyTickets';
import { useT } from '../../i18n';
import { clock, dayLabel } from '../../lib/format';
import { openTicket } from '../../lib/liveTrips';
import { useAuth } from '../../store/Auth';
import { colors, fonts, radius, space } from '../../theme/tokens';

/**
 * Shown while an admin reviews a new driver, when the account is suspended (with the
 * team's reason and an appeal, answered inside the app), or if the account isn't a driver.
 */
export default function DriverPending() {
  const { profile, refreshProfile, signOut } = useAuth();
  const toast = useToast();
  const t = useT();
  const [loading, setLoading] = useState(false);
  const isPassenger = profile?.role === 'passenger';
  const suspended = profile?.driver_status === 'suspendido';
  const Icon = isPassenger ? UserRound : suspended ? ShieldX : Clock3;
  const [appealing, setAppealing] = useState(false);
  const [appeal, setAppeal] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(0);

  const sendAppeal = async () => {
    setSending(true);
    try {
      const code = await openTicket('Apelación de suspensión', appeal.trim(), undefined, 'apelacion');
      toast(t('drv2.appeal.sent', { code }), 'success');
      setAppeal('');
      setAppealing(false);
      setSent((n) => n + 1);
    } catch (e) {
      toast(e instanceof Error ? e.message : t('common.somethingWrong'), 'warning');
    } finally {
      setSending(false);
    }
  };

  const check = async () => {
    setLoading(true);
    const p = await refreshProfile();
    setLoading(false);
    if (p?.role === 'admin' || p?.driver_status === 'aprobado') {
      toast(t('drv.pending.approved'));
      router.replace('/driver/home');
    } else toast(p?.driver_status === 'suspendido' ? t('drv.pending.suspendedTitle') : t('drv.pending.stillReviewing'), 'info');
  };

  return (
    <Screen bg={colors.midnight} header={<Header tone="dark" back={false} />}>
      <Animated.View entering={FadeIn} style={{ alignItems: 'center', paddingTop: space[8], gap: space[4] }}>
        <View style={{ width: 88, height: 88, borderRadius: 30, backgroundColor: suspended ? colors.danger : colors.lime, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={38} color={suspended ? colors.white : colors.onLime} />
        </View>
        <Txt v="h1" align="center" color={colors.ivory}>
          {isPassenger ? t('drv.pending.passengerTitle') : suspended ? t('drv.pending.suspendedTitle') : t('drv.pending.reviewTitle')}
        </Txt>
        <Txt v="body" align="center" color={colors.onDarkMuted} style={{ maxWidth: 320 }}>
          {isPassenger ? t('drv.pending.passengerBody') : suspended ? t('drv.pending.suspendedBody') : t('drv.pending.reviewBody')}
        </Txt>
      </Animated.View>

      {/* Human review: why the account is suspended (or on hold), as written by the team. */}
      {!isPassenger && profile?.status_reason ? (
        <Card tone="dark" style={{ marginTop: space[6], gap: 6, borderColor: suspended ? 'rgba(255,143,143,0.5)' : colors.lineDark }}>
          <Txt v="overline" color={suspended ? colors.dangerOnDark : colors.onDarkMuted}>
            {t('drv2.appeal.reason')}
          </Txt>
          <Txt v="body" color={colors.ivory}>
            {profile.status_reason}
          </Txt>
          {profile.status_changed_at ? (
            <Txt v="caption" color={colors.onDarkFaint}>
              {t('drv2.appeal.since', { date: `${dayLabel(new Date(profile.status_changed_at))} · ${clock(new Date(profile.status_changed_at))}` })}
            </Txt>
          ) : null}
        </Card>
      ) : null}

      {/* Appeal: a priority case for the team, answered inside the app (see "My cases"). */}
      {suspended ? (
        <Card tone="dark" style={{ marginTop: space[4], gap: space[3] }}>
          <Row style={{ gap: 8 }}>
            <Scale size={16} color={colors.limeOnDark} />
            <Txt v="bodyStrong" color={colors.ivory}>
              {t('drv2.appeal.title')}
            </Txt>
          </Row>
          <Txt v="small" color={colors.onDarkMuted}>
            {t('drv2.appeal.body')}
          </Txt>
          {appealing ? (
            <>
              <TextInput
                value={appeal}
                onChangeText={(v) => setAppeal(v.slice(0, 1500))}
                placeholder={t('drv2.appeal.ph')}
                placeholderTextColor={colors.onDarkFaint}
                multiline
                accessibilityLabel={t('drv2.appeal.title')}
                style={[
                  { minHeight: 120, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.lineDarkStrong, backgroundColor: colors.midnight800, padding: 14, color: colors.ivory, fontFamily: fonts.semibold, fontSize: 15, textAlignVertical: 'top' },
                  { outlineStyle: 'none' } as object,
                ]}
              />
              <Button label={t('drv2.appeal.send')} icon={Send} size="md" loading={sending} disabled={appeal.trim().length < 10} onPress={sendAppeal} />
              <Txt v="caption" color={colors.onDarkFaint}>
                {t('drv2.appeal.hint')}
              </Txt>
            </>
          ) : (
            <Button label={t('drv2.appeal.cta')} icon={Scale} variant="outlineDark" size="md" onPress={() => setAppealing(true)} />
          )}
        </Card>
      ) : null}

      {!isPassenger ? <MyTickets tone="dark" refreshKey={sent} /> : null}

      {!isPassenger && profile ? (
        <Card tone="dark" style={{ marginTop: space[8] }}>
          <KeyValue tone="dark" label={t('common.name')} value={profile.full_name || '—'} />
          <KeyValue tone="dark" label={t('common.vehicle')} value={[profile.vehicle?.brand, profile.vehicle?.model].filter(Boolean).join(' ') || '—'} />
          <KeyValue tone="dark" label={t('common.plate')} value={profile.vehicle?.plate ?? '—'} />
          <KeyValue tone="dark" label={t('drv.pending.nequi')} value={profile.payout?.nequi ?? '—'} />
        </Card>
      ) : null}

      <View style={{ gap: 10, marginTop: space[6] }}>
        {!isPassenger ? <Button label={t('drv.pending.checkAgain')} icon={RefreshCw} loading={loading} onPress={check} /> : null}
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
