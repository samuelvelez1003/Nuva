import React, { useState } from 'react';
import { Switch, View } from 'react-native';
import { router, Href } from 'expo-router';
import { Car, FileCheck2, Headset, Languages, LogOut, Star, Venus, Wallet } from 'lucide-react-native';
import { useT } from '../../../i18n';
import { Button, Tap } from '../../../components/ui/Button';
import { LanguagePicker } from '../../../components/ui/LanguagePicker';
import { Avatar, Badge, Card, Divider, ListRow, Row } from '../../../components/ui/primitives';
import { Header, Screen, useToast } from '../../../components/ui/Screen';
import { supabase } from '../../../lib/supabase';
import { Txt } from '../../../components/ui/Txt';
import { DRIVER_ME } from '../../../data/mock';
import { decimal, num } from '../../../lib/format';
import { useApp } from '../../../store/AppStore';
import { useAuth } from '../../../store/Auth';
import { colors, radius, space } from '../../../theme/tokens';

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'C';

export default function DriverProfile() {
  const { setDriverOnline, driverTrips } = useApp();
  const auth = useAuth();
  const t = useT();
  // Live: the signed-in driver's own account. Demo (no backend): the sample driver.
  const p = auth.live ? auth.profile : null;
  const live = !!p;

  const name = live ? p!.full_name || t('drv.profile.defaultName') : `${DRIVER_ME.firstName} ${DRIVER_ME.lastName}`;
  const rating = live ? p!.rating ?? 5 : DRIVER_ME.rating;
  const vehicle = live ? [p!.vehicle?.brand, p!.vehicle?.model].filter(Boolean).join(' ') || t('drv.profile.notRegistered') : DRIVER_ME.car;
  const plate = live ? p!.vehicle?.plate ?? '' : DRIVER_ME.plate;
  const payout = live ? (p!.payout?.nequi ? `Nequi ${p!.payout.nequi}` : t('drv.profile.addNequi')) : `${DRIVER_ME.nequi} · ${DRIVER_ME.bank}`;
  const trips = live ? driverTrips.length : DRIVER_ME.lifetimeTrips;
  const toast = useToast();
  const womenVerified = live && p!.gender === 'f' && !!p!.women_verified;
  const [savingWomen, setSavingWomen] = useState(false);
  // Her own choice, saved on her profile (the server only lets a verified woman keep it on).
  const setWomenOnly = async (v: boolean) => {
    if (!supabase || !p) return;
    setSavingWomen(true);
    const { error } = await supabase.from('profiles').update({ women_riders_only: v }).eq('id', p.id);
    if (!error) await auth.refreshProfile();
    setSavingWomen(false);
    toast(error ? error.message : v ? t('drv2.women.onlyWomenOn') : t('drv2.women.allRiders'), error ? 'warning' : 'success');
  };

  const rows = [
    {
      icon: Star,
      title: t('drv.profile.ratings'),
      subtitle: live ? t('drv.profile.ratingOf5', { rating: decimal(rating, 2) }) : t('drv.profile.ratingReviews', { rating: decimal(rating, 2), n: num(DRIVER_ME.ratingsCount) }),
      href: '/driver/ratings',
    },
    { icon: Car, title: t('drv.profile.myVehicle'), subtitle: [vehicle, plate].filter(Boolean).join(' · '), href: '/driver/vehicle' },
    { icon: FileCheck2, title: t('drv.profile.documents'), subtitle: live ? t('drv.profile.documentsSub') : t('drv.profile.soatExpires', { days: 9 }), href: '/driver/documents', badge: !live },
    {
      icon: Wallet,
      title: t('drv.profile.walletTitle'),
      subtitle: t('drv.profile.passengerPayments', { payout }),
      href: '/driver/wallet',
    },
    { icon: Headset, title: t('drv.profile.support'), subtitle: t('common.writeUsAnytime'), href: '/driver/support' },
  ];

  return (
    <Screen bg={colors.midnight} header={<Header title={t('common.profile')} back={false} tone="dark" />} contentStyle={{ paddingBottom: 140 }}>
      <Row style={{ gap: 16 }}>
        <Avatar initials={live ? initialsOf(name) : DRIVER_ME.initials} size={80} bg={colors.lime} fg={colors.onLime} image={p?.avatar_url} />
        <View style={{ flex: 1 }}>
          <Txt v="h2" color={colors.ivory}>
            {name}
          </Txt>
          <Txt v="small" color={colors.onDarkMuted}>
            {live ? t('drv.profile.liveSubtitle', { city: 'Pereira' }) : t('drv.profile.since', { since: DRIVER_ME.since })}
          </Txt>
          <Row style={{ gap: 6, marginTop: 8 }}>
            <Badge label={t(trips === 1 ? 'common.tripsCountOne' : 'common.tripsCount', { n: num(trips) })} tone="ghostDark" />
          </Row>
        </View>
      </Row>

      {/* Language: switches every screen right away (saved on the device). */}
      <Row style={{ marginTop: space[5], gap: 12, justifyContent: 'space-between' }}>
        <Row style={{ gap: 8, flexShrink: 1 }}>
          <Languages size={16} color={colors.onDarkMuted} />
          <Txt v="small" color={colors.onDarkMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
            {t('drv.profile.language')}
          </Txt>
        </Row>
        <LanguagePicker tone="dark" compact />
      </Row>

      <Row style={{ gap: 10, marginTop: space[5] }}>
        {(live
          ? [
              { v: decimal(rating, 2), l: t('common.rating') },
              { v: num(trips), l: t('common.trips') },
            ]
          : [
              { v: decimal(rating, 2), l: t('common.rating') },
              { v: `${Math.round(DRIVER_ME.acceptance * 100)} %`, l: t('drv.profile.acceptance') },
              { v: `${Math.round(DRIVER_ME.cancellation * 100)} %`, l: t('drv.profile.cancellation') },
            ]
        ).map((s) => (
          <View key={s.l} style={{ flex: 1, padding: 14, borderRadius: radius.lg, backgroundColor: colors.midnight700, borderWidth: 1, borderColor: colors.lineDark }}>
            <Txt v="h3" color={colors.ivory} tabular>
              {s.v}
            </Txt>
            <Txt v="caption" color={colors.onDarkMuted}>
              {s.l}
            </Txt>
          </View>
        ))}
      </Row>

      {/* NÜVA Mujeres: a woman driver verified by NÜVA may choose to take only women passengers. */}
      {live && p!.gender !== 'm' ? (
        <Card tone="dark" style={{ marginTop: space[5], gap: 8 }}>
          <Row style={{ gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.midnight600, alignItems: 'center', justifyContent: 'center' }}>
              <Venus size={19} color={colors.limeOnDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Row style={{ gap: 8 }}>
                <Txt v="bodyStrong" color={colors.onDark}>
                  {t('drv2.women.title')}
                </Txt>
                {womenVerified ? <Badge label={t('drv2.women.verified')} tone="lime" /> : null}
              </Row>
              <Txt v="small" color={colors.onDarkMuted}>
                {womenVerified ? t('drv2.women.onlyWomenSub') : t('drv2.women.notVerified')}
              </Txt>
            </View>
            {womenVerified ? (
              <Switch
                value={!!p!.women_riders_only}
                disabled={savingWomen}
                onValueChange={setWomenOnly}
                trackColor={{ true: colors.lime, false: colors.midnight500 }}
                thumbColor={colors.ivory}
                accessibilityLabel={t('drv2.women.onlyWomen')}
              />
            ) : null}
          </Row>
          {womenVerified ? (
            <Txt v="caption" color={colors.onDarkFaint}>
              {p!.women_riders_only ? t('drv2.women.onlyWomenOn') : t('drv2.women.onlyWomen')}
            </Txt>
          ) : (
            <Tap onPress={() => router.push('/driver/support')} accessibilityRole="link">
              <Txt v="smallStrong" color={colors.limeOnDark}>
                {t('drv2.women.ask')}
              </Txt>
            </Tap>
          )}
        </Card>
      ) : null}

      <Card tone="dark" padded={false} style={{ paddingHorizontal: space[4], marginTop: space[5] }}>
        {rows.map((r, i) => (
          <View key={r.title}>
            {i ? <Divider tone="dark" inset={54} /> : null}
            <ListRow tone="dark" icon={r.icon} title={r.title} subtitle={r.subtitle} onPress={() => router.push(r.href as Href)} right={r.badge ? <Badge label={t('drv.profile.review')} tone="warning" /> : undefined} />
          </View>
        ))}
      </Card>
      <Button
        label={t('common.signOut')}
        icon={LogOut}
        variant="outlineDark"
        size="md"
        style={{ marginTop: space[5] }}
        onPress={async () => {
          setDriverOnline(false);
          if (auth.live) await auth.signOut();
          router.replace('/');
        }}
      />
    </Screen>
  );
}
