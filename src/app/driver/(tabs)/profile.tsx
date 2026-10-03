import React from 'react';
import { View } from 'react-native';
import { router, Href } from 'expo-router';
import { Award, Car, FileCheck2, Headset, IdCard, Languages, LogOut, Star, Wallet } from 'lucide-react-native';
import { useT } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { LanguagePicker } from '../../../components/ui/LanguagePicker';
import { Avatar, Badge, Card, Divider, ListRow, ProgressBar, Row } from '../../../components/ui/primitives';
import { Header, Screen } from '../../../components/ui/Screen';
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
  const cw = p?.country === 'CW';
  const payout = live
    ? cw
      ? p!.payout?.bank || t('drv.profile.cashOrCard')
      : p!.payout?.nequi
        ? `Nequi ${p!.payout.nequi}`
        : t('drv.profile.addNequi')
    : `${DRIVER_ME.nequi} · ${DRIVER_ME.bank}`;
  const docs = cw
    ? t('drv.profile.docsCW', { license: p?.vehicle?.license ?? '—', date: p?.vehicle?.insuranceUntil?.split('-').reverse().join('/') ?? '—' })
    : t('drv.profile.documentsSub');
  const trips = live ? driverTrips.length : DRIVER_ME.lifetimeTrips;

  const rows = [
    {
      icon: Star,
      title: t('drv.profile.ratings'),
      subtitle: live ? t('drv.profile.ratingOf5', { rating: decimal(rating, 2) }) : t('drv.profile.ratingReviews', { rating: decimal(rating, 2), n: num(DRIVER_ME.ratingsCount) }),
      href: '/driver/ratings',
    },
    { icon: Car, title: t('drv.profile.myVehicle'), subtitle: [vehicle, plate].filter(Boolean).join(' · '), href: '/driver/vehicle' },
    { icon: FileCheck2, title: t('drv.profile.documents'), subtitle: live ? docs : t('drv.profile.soatExpires', { days: 9 }), href: '/driver/documents', badge: !live },
    {
      icon: IdCard,
      title: t('drv.profile.identity'),
      subtitle: live ? (p!.driver_status === 'aprobado' ? t('drv.profile.approved') : t('drv.profile.inReview')) : t('drv.profile.verified'),
      href: '/driver/verify',
    },
    {
      icon: Wallet,
      title: live ? t('drv.profile.walletTitle') : t('drv.profile.payoutAccounts'),
      subtitle: live ? t('drv.profile.passengerPayments', { payout }) : payout,
      href: live ? '/driver/wallet' : '/driver/withdraw',
    },
    { icon: Headset, title: t('drv.profile.support'), subtitle: t('common.writeUsAnytime'), href: '/driver/support' },
  ];

  return (
    <Screen bg={colors.midnight} header={<Header title={t('common.profile')} back={false} tone="dark" />} contentStyle={{ paddingBottom: 140 }}>
      <Row style={{ gap: 16 }}>
        <Avatar initials={live ? initialsOf(name) : DRIVER_ME.initials} size={80} bg={colors.lime} fg={colors.midnight} image={p?.avatar_url} />
        <View style={{ flex: 1 }}>
          <Txt v="h2" color={colors.ivory}>
            {name}
          </Txt>
          <Txt v="small" color={colors.onDarkMuted}>
            {live ? t('drv.profile.liveSubtitle', { city: cw ? t('drv.profile.cityCW') : 'Pereira' }) : t('drv.profile.since', { since: DRIVER_ME.since })}
          </Txt>
          <Row style={{ gap: 6, marginTop: 8 }}>
            {live ? null : <Badge label={t('drv.home.level', { level: DRIVER_ME.level })} tone="lime" />}
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

      {live ? null : (
        <Card tone="dark" style={{ marginTop: space[5] }}>
          <Row style={{ gap: 10 }}>
            <Award size={18} color={colors.lime} />
            <Txt v="bodyStrong" color={colors.ivory} style={{ flex: 1 }}>
              {t('drv.profile.diamondTitle')}
            </Txt>
            <Txt v="caption" color={colors.onDarkMuted}>
              {t('drv.profile.tripsMore', { n: 188 })}
            </Txt>
          </Row>
          <View style={{ marginTop: 12 }}>
            <ProgressBar value={0.72} tone="dark" />
          </View>
          <Txt v="caption" color={colors.onDarkMuted} style={{ marginTop: 10 }}>
            {t('drv.profile.diamondBody')}
          </Txt>
        </Card>
      )}

      <Row style={{ gap: 10, marginTop: live ? space[5] : space[3] }}>
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
