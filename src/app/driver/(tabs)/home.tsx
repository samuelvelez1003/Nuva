import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useAuth } from '../../../store/Auth';
import { CommissionRule, topUpNeeded } from '../../../lib/commission';
import { useDriverLive } from '../../../lib/useDriverLive';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ArrowUpRight, Bell, CheckCircle2, Clock3, Flame, Gauge, MapPin, Navigation, Star, Target, Wallet } from 'lucide-react-native';
import { fetchMyActiveTrip } from '../../../lib/liveTrips';
import { BarChart, Sparkline } from '../../../components/charts/Charts';
import { CityMap } from '../../../components/map/CityMap';
import { CarMarker } from '../../../components/map/Markers';
import { IconButton, Tap } from '../../../components/ui/Button';
import { OnlineToggle } from '../../../components/ui/OnlineToggle';
import { Avatar, Badge, LiveDot, ProgressBar, Row, SectionHeader } from '../../../components/ui/primitives';
import { useStatusTone, useToast } from '../../../components/ui/Screen';
import { Money, Txt } from '../../../components/ui/Txt';
import { DRIVER_ME, paymentLabel } from '../../../data/mock';
import { PLACES } from '../../../data/places';
import { cop, copCompact, decimal, km, pct, weekdayShort } from '../../../lib/format';
import { offset } from '../../../lib/geo';
import { greeting } from '../../../lib/hooks';
import { useLocation } from '../../../lib/location';
import { useNuvaSettings } from '../../../lib/settings';
import { useCountry } from '../../../lib/country';
import { useT } from '../../../i18n';
import { createRequest, DRIVER_LOCATION, requestFromTrip, RideRequest } from '../../../lib/requests';
import { dailySeries, sumTrips, todayTrips, useApp, weekSeries } from '../../../store/AppStore';
import { colors, radius, space } from '../../../theme/tokens';

/** Weekly goal in minor units of each country's currency: $1.200.000 COP · Cg2.500,00. */
const WEEKLY_GOAL: Record<string, number> = { CO: 1_200_000, CW: 250_000 };
/** Demo-only demand hotspots around the active country's popular places. */
const hotspots = () => [
  ...PLACES.slice(0, 2).map((p, i) => ({ center: p, radius: i ? 700 : 900, intensity: i ? 0.7 : 1 })),
  { center: offset(DRIVER_LOCATION, -900, 500), radius: 600, intensity: 0.45 },
];

function RequestCard({ req, index, rule }: { req: RideRequest; index: number; rule?: CommissionRule | null }) {
  const t = useT();
  // Not enough balance for this trip's commission (within the debt allowance): say how much to top up.
  const missing = topUpNeeded(rule, req.fare.platformCommission);
  const kind = (req.fare as { commissionRule?: string }).commissionRule;
  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(350)} style={missing ? { opacity: 0.55 } : undefined}>
      <Tap
        onPress={() =>
          missing
            ? router.push('/driver/wallet')
            : router.push({ pathname: '/driver/ride', params: req.tripId ? { trip: req.tripId } : { seed: req.id.replace('RQ-', '') } })
        }
        accessibilityLabel={t('drv.home.requestA11y', { area: req.destination.area, amount: cop(req.fare.driverEarnings), min: req.pickupMin })}
        style={{ backgroundColor: colors.midnight700, borderRadius: radius.lg, padding: space[4], borderWidth: 1, borderColor: colors.lineDark, marginBottom: 10 }}
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Row style={{ gap: 6 }}>
              <MapPin size={13} color={colors.onDarkMuted} />
              <Txt v="caption" color={colors.onDarkMuted}>
                {t('drv.home.pickupIn', { min: req.pickupMin, km: km(req.pickupKm) })}
              </Txt>
            </Row>
            <Txt v="title" color={colors.ivory} style={{ marginTop: 6 }} numberOfLines={1}>
              → {req.destination.area}
            </Txt>
            <Txt v="caption" color={colors.onDarkFaint}>
              {km(req.fare.distanceKm)} · {req.fare.durationMin} min · {paymentLabel(req.payment, t)}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt v="caption" color={colors.onDarkMuted}>
              {t('drv.home.youEarn')}
            </Txt>
            <Money value={cop(req.fare.driverEarnings)} size={24} color={colors.lime} />
            <Txt v="caption" color={colors.onDarkFaint} tabular>
              {t('drv.home.ofFare', { amount: cop(req.fare.finalFare) })}
            </Txt>
            {kind === 'free' ? <Badge label={t('drv.home.freeTrip')} tone="lime" style={{ marginTop: 4 }} /> : null}
            {kind === 'tier' || kind === 'challenge' ? <Badge label={t('drv.home.tierRate', { pct: pct(req.fare.commissionPct, 1) })} tone="lime" style={{ marginTop: 4 }} /> : null}
            {kind === 'pass' ? <Badge label={t('drv.home.passTrip')} tone="lime" style={{ marginTop: 4 }} /> : null}
          </View>
        </Row>
        {missing ? (
          <Row style={{ gap: 6, marginTop: 10 }}>
            <Wallet size={14} color={colors.danger} />
            <Txt v="smallStrong" color={colors.ivory}>
              {t('drv.home.needTopUp', { amount: cop(missing) })}
            </Txt>
          </Row>
        ) : null}
      </Tap>
    </Animated.View>
  );
}

export default function DriverDashboard() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const t = useT();
  const { driverOnline, setDriverOnline, driverTrips, pricing, reloadHistory } = useApp();
  const [selectedDay, setSelectedDay] = useState<number | undefined>(undefined);
  useStatusTone('light');

  const { profile, session } = useAuth();
  const location = useLocation();
  const gps = location.status === 'granted';
  const me = gps ? location.here : DRIVER_LOCATION;
  const focused = useIsFocused();
  const focusedRef = useRef(focused);
  focusedRef.current = focused;

  // Live mode: real requests arrive over Realtime and open the incoming screen.
  const live = useDriverLive(
    driverOnline,
    (trip) => {
      if (focusedRef.current) router.push({ pathname: '/driver/ride', params: { trip: trip.id } });
    },
    gps ? { lat: location.here.lat, lng: location.here.lng, heading: location.heading } : undefined,
  );
  useFocusEffect(
    useCallback(() => {
      live.refresh();
      reloadHistory();
      // A trip this driver accepted and didn't finish (app closed, back pressed) reopens,
      // so they're never stuck with "Ya tienes un viaje activo".
      const uid = session?.user.id;
      if (live.enabled && uid) {
        fetchMyActiveTrip('driver', uid)
          .then((trip) => {
            if (trip && trip.driver_id === uid && trip.status !== 'requested' && focusedRef.current) {
              router.push({ pathname: '/driver/ride', params: { trip: trip.id } });
            }
          })
          .catch(() => {});
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [live.refresh, reloadHistory, live.enabled, session?.user.id]),
  );

  const mockToday = sumTrips(todayTrips(driverTrips));
  const today = live.enabled
    ? { ...mockToday, count: live.summary?.trips ?? 0, gross: live.summary?.gross ?? 0, commission: live.summary?.commission ?? 0, net: live.summary?.net ?? 0 }
    : mockToday;
  const firstName = live.enabled ? (profile?.full_name?.split(' ')[0] || t('common.driver')) : DRIVER_ME.firstName;
  const initials = live.enabled ? (profile?.full_name ?? 'C').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() : DRIVER_ME.initials;
  const series = dailySeries(driverTrips, 8);
  const yesterday = series[series.length - 2]?.net ?? 0;
  const delta = yesterday ? (today.net - yesterday) / yesterday : 0;
  const week = weekSeries(driverTrips);
  const weekNet = week.reduce((a, d) => a + d.net, 0);
  const hoursOnline = Math.max(1, today.minutes / 60 + today.count * 0.15);

  // Low-balance alert threshold is set by the admin (nuva_settings).
  const { settings } = useNuvaSettings();
  const { country } = useCountry();
  const lowBalanceSetting = !live.wallet?.test && (live.wallet?.balance ?? 0) < settings.lowBalance;
  const weeklyGoal = WEEKLY_GOAL[country.code] ?? WEEKLY_GOAL.CO;

  // Live requests are re-priced whenever the admin publishes new rates.
  const demoRequests = useMemo(() => [1201, 1202, 1203].map((s) => createRequest(s, pricing)), [pricing]);
  // Fewer empty kilometres: requests beyond the admin's max pickup distance aren't offered.
  const maxKm = live.rule?.maxPickupKm ?? settings.maxPickupKm;
  const requests = live.enabled ? live.requests.map((trip) => requestFromTrip(trip, me, live.rule)).filter((r) => r.pickupKm <= maxKm) : demoRequests;
  // Demand map: where passengers are asking right now (all open requests, near or far).
  const demand = live.enabled ? live.requests.map((trip) => ({ center: { lat: trip.pickup.lat, lng: trip.pickup.lng }, radius: 450, intensity: 0.8 })) : undefined;
  // The real rule: warn when the balance is under the admin's alert OR a visible trip doesn't fit.
  const lowBalance = lowBalanceSetting || requests.some((r) => topUpNeeded(live.rule, r.fare.platformCommission) > 0);

  // Demo mode only: going online triggers one simulated request after a few
  // seconds — only while the dashboard is on screen, never over an active trip.
  const autoRequested = useRef(false);
  useEffect(() => {
    if (live.enabled) return;
    if (!driverOnline) {
      autoRequested.current = false;
      return;
    }
    if (!focused || autoRequested.current) return;
    const id = setTimeout(() => {
      autoRequested.current = true;
      router.push({ pathname: '/driver/ride', params: { seed: String(Date.now() % 100000) } });
    }, 6500);
    return () => clearTimeout(id);
  }, [driverOnline, focused, live.enabled]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        {/* Map header */}
        <View style={{ height: 300 + insets.top }}>
          <CityMap
            theme="dark"
            focus={[offset(me, -1600, -1900), offset(me, 1600, 600)]}
            minSpan={200}
            insets={{ top: insets.top, bottom: 40, left: 0, right: 0 }}
            hotspots={live.enabled ? (driverOnline ? demand : undefined) : driverOnline ? hotspots() : hotspots().map((h) => ({ ...h, intensity: h.intensity * 0.3 }))}
            renderMarkers={(toScreen) => <CarMarker pos={toScreen(me)} heading={gps ? location.heading : 20} tone="lime" size={38} />}
          />
          <LinearGradient
            colors={['rgba(16,20,17,0.85)', 'rgba(16,20,17,0)', 'rgba(16,20,17,0)', colors.midnight]}
            locations={[0, 0.32, 0.55, 1]}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            pointerEvents="none"
          />
          <Row style={{ position: 'absolute', top: insets.top + 10, left: space[5], right: space[5], gap: 12 }}>
            <Tap onPress={() => router.navigate('/driver/profile')} accessibilityLabel={t('common.profile')}>
              <Avatar initials={initials} size={46} bg={colors.lime} fg={colors.midnight} />
            </Tap>
            <View style={{ flex: 1 }}>
              <Txt v="caption" color={colors.onDarkMuted}>
                {greeting(new Date(), t)},
              </Txt>
              <Row style={{ gap: 8 }}>
                <Txt v="h3" color={colors.ivory}>
                  {firstName}
                </Txt>
                {live.enabled ? null : <Badge label={t('drv.home.level', { level: DRIVER_ME.level })} tone="lime" />}
              </Row>
            </View>
            <IconButton
              icon={Bell}
              label={t('common.notifications')}
              tone="dark"
              badge={!live.enabled}
              onPress={() => (live.enabled ? toast(t('drv.home.noNotifications'), 'info') : toast(t('drv.home.soatExpires', { days: 9 }), 'warning'))}
            />
          </Row>
          {driverOnline && live.enabled && !gps ? (
            <Animated.View entering={FadeInUp} style={{ position: 'absolute', bottom: 64, alignSelf: 'center' }}>
              <Tap onPress={location.request} accessibilityLabel={t('drv.home.enableGps')}>
                <Row style={{ gap: 8, backgroundColor: 'rgba(16,20,17,0.8)', borderRadius: radius.pill, paddingHorizontal: 14, height: 34, borderWidth: 1, borderColor: colors.lineDarkStrong }}>
                  <Navigation size={14} color={colors.lime} />
                  <Txt v="caption" color={colors.ivory}>
                    {t('drv.home.enableGpsHint')}
                  </Txt>
                </Row>
              </Tap>
            </Animated.View>
          ) : null}
          {driverOnline && !live.enabled ? (
            <Animated.View entering={FadeInUp} style={{ position: 'absolute', bottom: 64, alignSelf: 'center' }}>
              <Row style={{ gap: 8, backgroundColor: 'rgba(16,20,17,0.8)', borderRadius: radius.pill, paddingHorizontal: 14, height: 34, borderWidth: 1, borderColor: colors.lineDarkStrong }}>
                <Flame size={14} color={colors.lime} />
                <Txt v="caption" color={colors.ivory}>
                  {t('drv.home.highDemand', { area: 'La Arboleda', pct: 25 })}
                </Txt>
              </Row>
            </Animated.View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: space[4], marginTop: -48, gap: space[3] }}>
          {/* 1 — Today's net earnings */}
          <Tap onPress={() => router.navigate('/driver/earnings')} scaleTo={0.985} accessibilityLabel={t('drv.home.todayNetA11y', { amount: cop(today.net) })}>
            <View style={{ backgroundColor: colors.midnight700, borderRadius: radius.xl, padding: space[5], borderWidth: 1, borderColor: colors.lineDarkStrong }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="overline" color={colors.onDarkMuted}>
                  {t('drv.home.todayNet')}
                </Txt>
                <ArrowUpRight size={18} color={colors.onDarkMuted} />
              </Row>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 }}>
                <Money value={cop(today.net)} size={50} color={colors.ivory} signColor={colors.lime} />
                <View style={{ alignItems: 'flex-end', gap: 6, paddingBottom: 6 }}>
                  <Sparkline values={series.map((d) => d.net)} />
                  <Badge label={t('drv.home.vsYesterday', { delta: `${delta >= 0 ? '+' : '−'}${Math.abs(Math.round(delta * 100))}` })} tone={delta >= 0 ? 'lime' : 'ghostDark'} />
                </View>
              </Row>
              <Row style={{ marginTop: space[4], paddingTop: space[3], borderTopWidth: 1, borderTopColor: colors.lineDark, gap: 16 }}>
                <View>
                  <Txt v="caption" color={colors.onDarkFaint}>
                    {t('drv.home.charged')}
                  </Txt>
                  <Txt v="smallStrong" color={colors.onDark} tabular>
                    {cop(today.gross)}
                  </Txt>
                </View>
                <View>
                  <Txt v="caption" color={colors.onDarkFaint}>
                    {t('common.nuvaCommission')}
                  </Txt>
                  <Txt v="smallStrong" color={colors.onDark} tabular>
                    −{cop(today.commission)}
                  </Txt>
                </View>
                <View>
                  {/* Live: per trip (real). Hours online aren't tracked by the server, so no per-hour figure. */}
                  <Txt v="caption" color={colors.onDarkFaint}>
                    {live.enabled ? t('drv.home.perTrip') : t('drv.home.perHour')}
                  </Txt>
                  <Txt v="smallStrong" color={colors.onDark} tabular>
                    {cop(Math.round(live.enabled ? today.net / Math.max(1, today.count) : today.net / hoursOnline))}
                  </Txt>
                </View>
              </Row>
            </View>
          </Tap>

          {/* 2 — Online status */}
          <OnlineToggle
            online={driverOnline}
            onChange={(v) => {
              setDriverOnline(v);
              if (v && location.status !== 'granted') location.request();
              toast(v ? t('drv.home.wentOnline') : t('drv.home.wentOffline'), v ? 'success' : 'info');
            }}
          />

          {/* Prepaid wallet: commissions are deducted automatically per trip. */}
          {live.enabled && live.wallet ? (
            <Tap onPress={() => router.push('/driver/wallet')} accessibilityLabel={t('drv.home.walletA11y', { amount: cop(live.wallet.balance) })}>
              <Row style={{ padding: space[4], borderRadius: radius.lg, gap: 12, backgroundColor: lowBalance ? 'rgba(255,91,74,0.14)' : colors.midnight700, borderWidth: 1, borderColor: lowBalance ? 'rgba(255,91,74,0.5)' : colors.lineDark }}>
                <Wallet size={20} color={lowBalance ? colors.danger : colors.lime} />
                <View style={{ flex: 1 }}>
                  <Txt v="caption" color={colors.onDarkMuted}>
                    {t('drv.home.walletLabel')}
                  </Txt>
                  <Txt v="title" color={colors.ivory} tabular>
                    {cop(live.wallet.balance)}
                  </Txt>
                </View>
                <Badge label={lowBalance ? t('drv.home.topUpToContinue') : t('drv.home.topUp')} tone={lowBalance ? 'danger' : 'lime'} />
              </Row>
            </Tap>
          ) : null}

          {/* 3 — Available ride requests */}
          <View style={{ marginTop: space[4] }}>
            <SectionHeader
              tone="dark"
              title={driverOnline ? t('drv.home.requestsNearby') : t('drv.home.requests')}
              action={driverOnline && !live.enabled ? t('drv.home.simulate') : undefined}
              onAction={() => router.push({ pathname: '/driver/ride', params: { seed: String(Date.now() % 100000) } })}
            />
            {driverOnline ? (
              <>
                <Row style={{ gap: 8, marginBottom: 10 }}>
                  <LiveDot />
                  <Txt v="small" color={colors.onDarkMuted}>
                    {t('drv.home.availableLive', { n: requests.length })}
                  </Txt>
                </Row>
                {requests.map((r, i) => (
                  <RequestCard key={r.id} req={r} index={i} rule={live.enabled ? live.rule : null} />
                ))}
              </>
            ) : (
              <View style={{ backgroundColor: colors.midnight700, borderRadius: radius.lg, padding: space[5], borderWidth: 1, borderColor: colors.lineDark, borderStyle: 'dashed', alignItems: 'center', gap: 6 }}>
                <Navigation size={22} color={colors.onDarkMuted} />
                <Txt v="bodyStrong" color={colors.ivory} align="center">
                  {t('drv.home.goOnlineTitle')}
                </Txt>
                <Txt v="small" color={colors.onDarkMuted} align="center">
                  {live.enabled ? t('drv.home.goOnlineLive', { city: country.cityLong }) : t('drv.home.goOnlineDemo', { n: requests.length })}
                </Txt>
              </View>
            )}
          </View>

          {/* 4 & 5 — Completed trips and rating */}
          <Row style={{ gap: 10, marginTop: space[3] }}>
            {[
              { icon: CheckCircle2, value: `${today.count}`, label: t('drv.home.tripsToday') },
              { icon: Star, value: decimal(live.enabled ? (profile?.rating ?? 5) : DRIVER_ME.rating, 2), label: t('common.rating'), onPress: () => router.push('/driver/ratings') },
              live.enabled
                ? { icon: Wallet, value: cop(today.commission), label: t('drv.home.commissionToday') }
                : { icon: Clock3, value: t('drv.home.hours', { n: decimal(hoursOnline, 1) }), label: t('drv.home.online') },
            ].map((s) => (
              <Tap key={s.label} onPress={s.onPress} disabled={!s.onPress} style={{ flex: 1, backgroundColor: colors.midnight700, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.lineDark }}>
                <s.icon size={16} color={colors.lime} />
                <Txt v="h2" color={colors.ivory} tabular style={{ marginTop: 10 }}>
                  {s.value}
                </Txt>
                <Txt v="caption" color={colors.onDarkMuted}>
                  {s.label}
                </Txt>
              </Tap>
            ))}
          </Row>

          {/* 6 — Weekly performance */}
          <View style={{ backgroundColor: colors.midnight700, borderRadius: radius.xl, padding: space[5], borderWidth: 1, borderColor: colors.lineDark, marginTop: space[3] }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Txt v="overline" color={colors.onDarkMuted}>
                  {t('drv.home.thisWeek')}
                </Txt>
                <Txt v="h2" color={colors.ivory} tabular style={{ marginTop: 6 }}>
                  {cop(weekNet)}
                </Txt>
              </View>
              {live.enabled ? null : (
                <Row style={{ gap: 6 }}>
                  <Gauge size={14} color={colors.onDarkMuted} />
                  <Txt v="caption" color={colors.onDarkMuted}>
                    {t('drv.home.acceptance', { pct: Math.round(DRIVER_ME.acceptance * 100) })}
                  </Txt>
                </Row>
              )}
            </Row>
            <View style={{ marginTop: space[5] }}>
              <BarChart
                data={week.map((d) => ({ label: weekdayShort(d.date), value: d.net, highlight: d.date.toDateString() === new Date().toDateString(), muted: d.future }))}
                format={copCompact}
                selected={selectedDay}
                onSelect={(i) => setSelectedDay(i === selectedDay ? undefined : i)}
                height={110}
              />
            </View>
            <Row style={{ justifyContent: 'space-between', marginTop: space[5], marginBottom: 8 }}>
              <Row style={{ gap: 6 }}>
                <Target size={14} color={colors.lime} />
                <Txt v="caption" color={colors.onDark}>
                  {t('drv.home.weeklyGoal', { amount: copCompact(weeklyGoal) })}
                </Txt>
              </Row>
              <Txt v="caption" color={colors.onDarkMuted} tabular>
                {Math.min(100, Math.round((weekNet / weeklyGoal) * 100))} %
              </Txt>
            </Row>
            <ProgressBar value={weekNet / weeklyGoal} tone="dark" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
