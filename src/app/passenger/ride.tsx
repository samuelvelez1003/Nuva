import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, Share, TextInput, View } from 'react-native';
import { TripChat, useTripChat } from '../../components/trip/TripChat';
import { useAuth } from '../../store/Auth';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Bike,
  Car,
  Check,
  ChevronDown,
  Landmark,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wallet,
  Zap,
} from 'lucide-react-native';
import { CityMap } from '../../components/map/CityMap';
import { CarMarker, PlacePin, UserDot } from '../../components/map/Markers';
import { FareBreakdownCard } from '../../components/fare/FareBreakdownCard';
import { Button, IconButton, Tap } from '../../components/ui/Button';
import { Avatar, Badge, Chip, Divider, LiveDot, ProgressBar, Row, Stars } from '../../components/ui/primitives';
import { Sheet } from '../../components/ui/Sheet';
import { useStatusTone, useToast } from '../../components/ui/Screen';
import { Money, Txt } from '../../components/ui/Txt';
import { CURRENT_LOCATION, Place, PLACES } from '../../data/places';
import { useLocation } from '../../lib/location';
import { useSavedPlaces } from '../../lib/savedPlaces';
import { PAYMENT_METHODS, paymentDetail, paymentLabel, paymentMethodsFor, PaymentId, RATING_TAGS_PASSENGER } from '../../data/mock';
import { TFunction, TKey, useT } from '../../i18n';
import { useCountry } from '../../lib/country';
import { calculateFare, CategoryId, CATEGORY_ORDER } from '../../lib/fare';
import { addMinutes, clock, cop, km, minutes, num } from '../../lib/format';
import { buildRoute, LatLng, offset, pointAlong, project, routeMetrics } from '../../lib/geo';
import { OFF_ROUTE_M, snapToRoute, useGlide } from '../../lib/carMotion';
import { fetchRoute, RouteResult } from '../../lib/routing';
import { useProgress, useTick } from '../../lib/hooks';
import { cancelTrip, Counterpart, fetchCounterpart, fetchMyPin, fetchTrip, TripRow, watchPresence, watchTrip } from '../../lib/liveTrips';
import { useApp } from '../../store/AppStore';
import type { DriverProfile } from '../../data/mock';
import { colors, fonts, radius, shadow, space } from '../../theme/tokens';

const CAT_ICON: Record<CategoryId, typeof Car> = { moto: Bike, go: Car, eco: Zap, confort: Sparkles, xl: Users };

/** Server counterpart card → the driver shape the ride UI renders. */
function driverFromCounterpart(id: string, c: Counterpart, t: TFunction): DriverProfile {
  const v = c.vehicle ?? {};
  return {
    id,
    name: c.name,
    initials: c.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
    rating: Number(c.rating) || 5,
    trips: 0,
    car: [v.brand, v.model].filter(Boolean).join(' ') || t('common.vehicle'),
    color: v.color || '',
    plate: v.plate ? `${v.plate.slice(0, 3)} ${v.plate.slice(3)}` : '—',
    years: 0,
    tone: '#C8D9B0',
    phoneMasked: t('pax.ride.maskedCall'),
    phone: c.phone ?? null,
  };
}
const PAY_ICON = { cash: Banknote, wallet: Wallet, bank: Landmark, card: CreditCard };

/** Licence plate: yellow, black, framed; the bottom line names the country. */
function Plate({ plate, region }: { plate: string; region: string }) {
  return (
    <View style={{ backgroundColor: '#F6CB2F', borderRadius: 6, borderWidth: 2, borderColor: colors.midnight, paddingHorizontal: 8, paddingTop: 2, paddingBottom: 1, alignItems: 'center' }}>
      <Txt style={{ fontFamily: fonts.extrabold, fontSize: 17, letterSpacing: 1.2, lineHeight: 20 }} color={colors.midnight}>
        {plate}
      </Txt>
      <Txt style={{ fontFamily: fonts.bold, fontSize: 7, letterSpacing: 1.5, lineHeight: 9 }} color={colors.midnight}>
        {region}
      </Txt>
    </View>
  );
}

/** "Cg12,50 por transferencia a MCB 1234567", "$9.300 en efectivo", … */
function payInstruction(t: TFunction, method: PaymentId, amount: string, account?: string | null) {
  const label = paymentLabel(method, t);
  if (method === 'cash') return t('pax.ride.cashAmount', { amount });
  if (method === 'card') return t('pax.ride.cardAmount', { amount });
  const acct = account ? (/^\d{10}$/.test(account) ? account.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') : account) : null;
  if (method === 'transfer') return acct ? t('pax.ride.transferTo', { amount, account: acct }) : t('pax.ride.transferAsk', { amount });
  return acct ? t('pax.ride.walletTo', { amount, method: label, account: acct }) : t('pax.ride.walletAsk', { amount, method: label });
}

function PaymentPill({ id, onPress }: { id: PaymentId; onPress: () => void }) {
  const t = useT();
  const m = PAYMENT_METHODS.find((p) => p.id === id)!;
  const Icon = PAY_ICON[m.kind];
  const label = paymentLabel(id, t);
  return (
    <Tap onPress={onPress} accessibilityLabel={t('pax.ride.paymentA11y', { method: label })}>
      <Row style={{ gap: 8, height: 40, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.ivory100 }}>
        <Icon size={17} color={colors.ink} />
        <Txt v="smallStrong">{label}</Txt>
        <Txt v="caption" color={colors.inkMuted}>
          {paymentDetail(id, t).split(' ·')[0]}
        </Txt>
        <ChevronDown size={15} color={colors.inkMuted} />
      </Row>
    </Tap>
  );
}

type Mode = 'categories' | 'breakdown' | 'payment' | 'pickup';

export default function RideFlow() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const t = useT();
  const app = useApp();
  const { ride, pricing, payment, setPayment } = app;
  const { profile, session, live: backendLive } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  // Chat with the driver: only once a driver accepted, until the trip ends.
  const chatTripId = ride?.tripId && ride.driver && (ride.phase === 'assigned' || ride.phase === 'arriving' || ride.phase === 'in-trip') ? ride.tripId : undefined;
  const chat = useTripChat(chatTripId, session?.user.id, chatOpen);
  const { code: countryCode, country } = useCountry();
  const [mode, setMode] = useState<Mode>('categories');
  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState<TKey[]>(['pax.tag.punctual']);
  const [tip, setTip] = useState(0);
  const [note, setNote] = useState('');
  const [requesting, setRequesting] = useState(false);
  useStatusTone('dark');
  const location = useLocation();
  const savedPlaces = useSavedPlaces();

  // Deep-link / screen index entry: start a sample quote.
  useEffect(() => {
    if (!ride) app.startQuote(PLACES.find((p) => p.id === country.web.heroDest) ?? PLACES[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phase = ride?.phase ?? 'quote';
  const quotes = useMemo(
    () => (ride ? CATEGORY_ORDER.filter((c) => pricing.categories[c].enabled).map((c) => calculateFare(ride, pricing, c)) : []),
    [ride, pricing],
  );
  const selected = quotes.find((q) => q.category === ride?.category) ?? quotes[0];
  const fare = ride?.fare ?? selected;
  // A category paused by the admin while quoting: switch to the one actually shown, so the
  // button, the price and what's sent to the server always match.
  useEffect(() => {
    if (ride?.phase === 'quote' && selected && selected.category !== ride.category) app.setCategory(selected.category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.phase, ride?.category, selected?.category]);

  // Live trips follow the server; demo trips run on timers.
  const live = !!ride?.tripId;

  // Driver approach on real streets (OSRM). Live: from the driver's real position,
  // re-routed when they leave it. Demo: from a point about 1 km away.
  const approaching = ride?.phase === 'assigned' || ride?.phase === 'arriving';
  const demoStart = useMemo(() => (ride ? offset(ride.pickup, 820, -640) : CURRENT_LOCATION), [ride?.pickup]);
  const [approachR, setApproachR] = useState<{ rideId: string; r: RouteResult } | null>(null);
  const lastRoute = useRef(0);
  const routeTo = useCallback(
    (from: LatLng) => {
      if (!ride) return;
      const rideId = ride.id;
      lastRoute.current = Date.now();
      fetchRoute(from, ride.pickup).then((r) => setApproachR({ rideId, r }));
    },
    [ride],
  );
  const hasDriverPos = !!ride?.driverPos;
  useEffect(() => {
    if (!ride || !approaching) return;
    if (approachR?.rideId === ride.id) return;
    if (live && !ride.driverPos) return; // wait for the first real position
    routeTo(live && ride.driverPos ? ride.driverPos : demoStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.id, approaching, live, hasDriverPos]);
  const approachRoute = approachR && ride && approachR.rideId === ride.id ? approachR.r : null;
  const approachOrigin = live && ride?.driverPos ? ride.driverPos : demoStart;
  const approach = useMemo(
    () => approachRoute?.points ?? (ride ? [project(approachOrigin), project(ride.pickup)] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [approachRoute, ride?.pickup, approachOrigin.lat, approachOrigin.lng],
  );
  const approachEta = approachRoute?.durationMin ?? (ride ? routeMetrics(buildRoute(approachOrigin, ride.pickup)).durationMin : 1);
  const simMatchP = useProgress(3800, phase === 'matching' && !live, ride?.id, () => app.assignDriver());
  const simApproachP = useProgress(11000, phase === 'assigned' && !live, ride?.id, () => app.setRidePhase('arriving'));
  const simTripP = useProgress(20000, phase === 'in-trip' && !live, ride?.id, () => app.completeRide());
  const tick = useTick(1000, live && (phase === 'matching' || phase === 'in-trip'));

  // Server → screen: trip status changes arrive over Realtime.
  useEffect(() => {
    const tripId = ride?.tripId;
    if (!tripId) return;
    const apply = async (row: TripRow) => {
      if (row.status === 'accepted' || row.status === 'arriving' || row.status === 'in_progress') {
        const cp = await fetchCounterpart(row.id).catch(() => null);
        app.patchRide({
          // A failed lookup keeps the driver already shown (and with it the PIN card).
          ...(cp ? { driver: driverFromCounterpart(row.driver_id ?? 'driver', cp, t), driverNequi: cp.payAccount ?? cp.nequi ?? null } : {}),
          phase: row.status === 'accepted' ? 'assigned' : row.status === 'arriving' ? 'arriving' : 'in-trip',
          // The server's start time, so progress doesn't reset when the screen reopens.
          ...(row.status === 'in_progress' ? { startedAt: row.started_at ? new Date(row.started_at) : new Date() } : {}),
        });
      } else if (row.status === 'completed') {
        const cp = await fetchCounterpart(row.id).catch(() => null);
        if (cp) app.patchRide({ driverNequi: cp.payAccount ?? cp.nequi ?? null });
        app.completeRide(); // no-op once completed/rated (rating and payment confirmation also update the row)
      } else if (row.status === 'cancelled') {
        toast(t('pax.ride.cancelledByServer'), 'warning');
        app.patchRide({ phase: 'quote', tripId: undefined, driver: undefined, driverPos: undefined });
      }
    };
    fetchTrip(tripId)
      .then((row) => {
        if (row.status !== 'requested') apply(row);
      })
      .catch(() => {});
    return watchTrip(tripId, apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.tripId]);

  // Boarding PIN: generated by the server, only visible to this passenger.
  const [boardingPin, setBoardingPin] = useState<string | null>(null);
  useEffect(() => {
    setBoardingPin(null);
  }, [ride?.tripId]);
  // Fetched once a driver is assigned, and retried every few seconds until it arrives.
  const needPin = !!ride?.tripId && (phase === 'assigned' || phase === 'arriving') && !boardingPin;
  useEffect(() => {
    if (!needPin || !ride?.tripId) return;
    const tripId = ride.tripId;
    let alive = true;
    const load = () => fetchMyPin(tripId).then((p) => alive && p && setBoardingPin(p)).catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [needPin, ride?.tripId]);

  // Nobody accepted in 10 minutes (drivers only see requests from the last 15): cancel and say so.
  useEffect(() => {
    if (!live || phase !== 'matching' || !ride?.requestedAt) return;
    const left = 10 * 60_000 - (Date.now() - ride.requestedAt.getTime());
    const id = setTimeout(() => {
      app
        .cancelRide({ keepQuote: true })
        .then(() => toast(t('pax.ride.noDriversFound'), 'warning'))
        .catch(() => {});
    }, Math.max(0, left));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, phase, ride?.requestedAt]);

  // Live driver position for the car on the map.
  const liveDriverId = live ? ride?.driver?.id : undefined;
  useEffect(() => {
    if (!liveDriverId || liveDriverId === 'driver') return;
    return watchPresence(liveDriverId, (p) => {
      if (p.lat != null && p.lng != null) app.patchRide({ driverPos: { lat: p.lat, lng: p.lng, heading: p.heading ?? 0 } });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveDriverId]);

  const elapsed = ride?.requestedAt ? (Date.now() - ride.requestedAt.getTime()) / 1000 : 0;
  const matchP = live ? (elapsed % 6) / 6 : simMatchP;
  void tick;

  // Live car: the driver's GPS snapped onto the street being driven (approach or trip).
  const livePos = ride?.driverPos ? { ...project(ride.driverPos), heading: ride.driverPos.heading } : null;
  const activeRoute = approaching ? approach : ride?.phase === 'in-trip' ? ride.route : null;
  const snap = livePos && activeRoute ? snapToRoute(activeRoute, livePos) : null;
  const onRoute = !!snap && snap.offM < OFF_ROUTE_M;
  // Left the suggested route: ask for a new one from where the driver really is (at most every 15 s).
  useEffect(() => {
    if (!live || !approaching || !ride?.driverPos || !snap || onRoute) return;
    if (Date.now() - lastRoute.current > 15_000) routeTo(ride.driverPos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, approaching, ride?.driverPos?.lat, ride?.driverPos?.lng]);
  const liveCar = livePos ? (onRoute && snap ? { ...snap.pt, heading: snap.heading } : livePos) : null;
  const glidingCar = useGlide(live ? liveCar : null);

  const liveTripTime = ride?.startedAt ? Math.min(0.98, (Date.now() - ride.startedAt.getTime()) / (ride.durationMin * 60_000)) : 0;
  const tripP = live ? (ride?.phase === 'in-trip' && onRoute && snap ? snap.fraction : liveTripTime) : simTripP;
  const approachP = live ? (approaching && onRoute && snap ? snap.fraction : 0) : simApproachP;

  // Arrival time is fixed when the trip starts; only the countdown moves.
  const [arrival, setArrival] = useState<Date>(new Date());
  useEffect(() => {
    if (phase === 'in-trip' && ride) setArrival(addMinutes(new Date(), ride.durationMin));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== 'arriving' || live) return;
    const id = setTimeout(() => app.setRidePhase('in-trip'), 3200);
    return () => clearTimeout(id);
  }, [phase, app, live]);

  if (!ride || !fare) return <View style={{ flex: 1, backgroundColor: colors.ivory200 }} />;

  // Pickup: where the phone is, plus the passenger's saved places.
  // A pickup chosen by searching an address also shows (selected) in the list.
  const searchedPickup = ride.pickup.id !== 'current' && !savedPlaces.places.some((p) => p.id === ride.pickup.id) ? [ride.pickup] : [];
  const pickupOptions: Place[] = [location.here, ...searchedPickup, ...savedPlaces.places.filter((p) => p.id !== ride.destination.id)].filter(
    (p, i, a) => a.findIndex((q) => q.id === p.id) === i,
  );

  // ── Map composition per phase ──
  // Live: only the driver's real position is drawn — no car until it arrives.
  const carOnApproach = live ? glidingCar : pointAlong(approach, approachP);
  const carOnTrip = live ? glidingCar : pointAlong(ride.route, tripP);
  const sheetH = phase === 'quote' ? 470 : phase === 'completed' ? 600 : phase === 'rated' ? 380 : 330;
  const focus =
    phase === 'quote' && mode === 'pickup'
      ? [offset(ride.pickup, -300, -300), offset(ride.pickup, 300, 300)]
      : phase === 'quote'
        ? ride.route
        : phase === 'matching'
          ? [offset(ride.pickup, -700, -700), offset(ride.pickup, 700, 700)]
          : phase === 'assigned' || phase === 'arriving'
            ? [...approach, project(ride.pickup)]
            : phase === 'in-trip'
              ? ride.route
              : [offset(ride.destination, -400, -400), offset(ride.destination, 400, 400)];

  const remainingMin = Math.max(1, Math.round(ride.durationMin * (1 - tripP)));
  // Minutes left on the street route (with traffic), from where the car is on it.
  // Live without a driver position yet: the category's typical pickup time, not a made-up route.
  const approachLeft =
    live && !ride.driverPos ? pricing.categories[ride.category].etaMinutes : Math.max(1, Math.round(approachEta * (1 - approachP)));

  // navigate (not replace) returns to the tabs already mounted below.
  const exit = () => {
    app.clearRide();
    router.navigate('/passenger/home');
  };
  /** Shares the real trip (driver, plate, destination) through the phone's share sheet. */
  const shareTrip = () => {
    const message = t('pax.ride.shareMessage', {
      driver: ride.driver?.name ?? t('pax.ride.yourDriver'),
      plate: ride.driver?.plate ?? '—',
      car: ride.driver?.car ?? '',
      place: ride.destination.name,
      code: ride.tripCode ?? ride.id,
    });
    Share.share({ message }).catch(() => toast(t('pax.ride.shareError'), 'warning'));
  };
  /** Cancels on the server first; the screen only changes once the server agreed. */
  const cancelActive = async (next: () => void, keepQuote = false) => {
    try {
      await app.cancelRide({ keepQuote });
      next();
    } catch (e) {
      toast(e instanceof Error ? e.message : t('pax.ride.cancelError'), 'warning');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.ivory200 }}>
      <CityMap
        focus={focus}
        minSpan={phase === 'matching' ? 140 : 90}
        insets={{ top: insets.top + 124, bottom: sheetH + 24, left: 48, right: 48 }}
        route={phase === 'assigned' || phase === 'arriving' ? approach : phase === 'completed' || phase === 'rated' ? undefined : ride.route}
        progress={phase === 'assigned' ? approachP : phase === 'in-trip' ? tripP : 0}
        hotspots={phase === 'matching' ? [{ center: ride.pickup, radius: 900, intensity: 0.4 + 0.6 * Math.abs(Math.sin(matchP * Math.PI * 3)) }] : undefined}
        renderMarkers={(toScreen) => (
          <>
            {phase === 'quote' || phase === 'matching' ? (
              <PlacePin
                pos={toScreen(ride.pickup)}
                kind="pickup"
                title={mode === 'pickup' ? ride.pickup.name : t('common.pickup')}
                sub={phase === 'quote' && mode !== 'pickup' ? t('common.minutesShort', { n: pricing.categories[ride.category].etaMinutes }) : undefined}
              />
            ) : null}
            {phase === 'assigned' || phase === 'arriving' ? (
              <>
                <UserDot pos={toScreen(ride.pickup)} />
                {carOnApproach ? <CarMarker pos={toScreen(carOnApproach)} heading={carOnApproach.heading} /> : null}
              </>
            ) : null}
            {phase !== 'assigned' && phase !== 'arriving' && phase !== 'matching' ? (
              <PlacePin
                pos={toScreen(ride.destination)}
                kind="dropoff"
                title={phase === 'quote' && mode === 'pickup' ? undefined : ride.destination.name}
                sub={phase === 'in-trip' ? clock(arrival) : phase === 'quote' ? minutes(ride.durationMin) : undefined}
              />
            ) : null}
            {phase === 'in-trip' && carOnTrip ? <CarMarker pos={toScreen(carOnTrip)} heading={carOnTrip.heading} /> : null}
          </>
        )}
      />

      {/* Top bar */}
      <Row style={{ position: 'absolute', top: insets.top + 8, left: space[4], right: space[4], gap: 10 }}>
        <IconButton
          icon={ArrowLeft}
          label={phase === 'quote' ? t('common.back') : t('common.goHome')}
          size={46}
          onPress={() => {
            if (phase === 'quote' && mode !== 'categories') return setMode('categories');
            if (phase === 'quote') {
              app.clearRide();
              return router.canGoBack() ? router.back() : router.replace('/passenger/home');
            }
            router.navigate('/passenger/home');
          }}
        />
        {phase === 'quote' ? (
          <Tap onPress={() => router.push('/passenger/search')} style={[{ flex: 1, height: 46, borderRadius: radius.pill, backgroundColor: colors.white, paddingHorizontal: 16, justifyContent: 'center' }, shadow.soft]} accessibilityLabel={t('pax.ride.changeDest')}>
            <Txt v="caption" color={colors.inkMuted} numberOfLines={1}>
              {ride.pickup.address} →
            </Txt>
            <Txt v="smallStrong" numberOfLines={1}>
              {ride.destination.name} · {km(ride.distanceKm)}
            </Txt>
          </Tap>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {phase !== 'quote' && phase !== 'matching' ? (
          <IconButton icon={ShieldCheck} label={t('common.safetyCenter')} size={46} onPress={() => router.push('/passenger/safety')} />
        ) : null}
      </Row>

      {/* ── QUOTE ─────────────────────────────────────────────── */}
      {phase === 'quote' ? (
        <Sheet stateKey={`quote-${mode}`}>
          {mode === 'categories' ? (
            <>
              <Row style={{ justifyContent: 'space-between', paddingHorizontal: space[5], marginBottom: 6 }}>
                <View>
                  <Txt v="h3">{t('pax.ride.chooseHow')}</Txt>
                  <Txt v="caption" color={colors.inkMuted}>
                    {km(ride.distanceKm)} · {minutes(ride.durationMin)} ·{' '}
                    {t('pax.ride.arriveAt', { time: clock(addMinutes(new Date(), ride.durationMin + pricing.categories[ride.category].etaMinutes)) })}
                  </Txt>
                </View>
                <Tap onPress={() => setMode('pickup')} accessibilityLabel={t('pax.ride.adjustPickup')}>
                  <Row style={{ gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.ivory100 }}>
                    <MapPin size={14} color={colors.ink} />
                    <Txt v="caption">{t('common.pickup')}</Txt>
                  </Row>
                </Tap>
              </Row>
              <ScrollView style={{ maxHeight: 248 }} contentContainerStyle={{ paddingHorizontal: space[3] }} showsVerticalScrollIndicator={false}>
                {quotes.map((q, i) => {
                  const c = pricing.categories[q.category];
                  const active = q.category === ride.category;
                  const Icon = CAT_ICON[q.category];
                  return (
                    <Animated.View key={q.category} entering={FadeInDown.delay(i * 50).duration(300)}>
                      <Tap
                        onPress={() => app.setCategory(q.category)}
                        scaleTo={0.98}
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={t('pax.ride.categoryA11y', { name: c.name, amount: cop(q.finalFare), min: c.etaMinutes })}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 14,
                          padding: 12,
                          borderRadius: radius.lg,
                          borderWidth: 2,
                          borderColor: active ? colors.midnight : 'transparent',
                          backgroundColor: active ? colors.ivory50 : 'transparent',
                        }}
                      >
                        <View style={{ width: 52, height: 44, borderRadius: 14, backgroundColor: active ? colors.midnight : colors.ivory100, alignItems: 'center', justifyContent: 'center' }}>
                          <Icon size={22} color={active ? colors.lime : colors.ink} strokeWidth={2.1} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Row style={{ gap: 6 }}>
                            <Txt v="title">{c.name}</Txt>
                            <Users size={12} color={colors.inkMuted} />
                            <Txt v="caption" color={colors.inkMuted}>
                              {c.seats}
                            </Txt>
                            {q.category === 'eco' ? <Badge label="0 CO₂" tone="success" /> : null}
                          </Row>
                          <Txt v="caption" color={colors.inkMuted} numberOfLines={1}>
                            {t('common.minutesShort', { n: c.etaMinutes })} · {c.tagline}
                          </Txt>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Txt v="title" tabular>
                            {cop(q.finalFare)}
                          </Txt>
                          {q.minimumApplied ? (
                            <Txt v="caption" color={colors.inkMuted}>
                              {t('pax.ride.minimum')}
                            </Txt>
                          ) : null}
                        </View>
                      </Tap>
                    </Animated.View>
                  );
                })}
              </ScrollView>
              <View style={{ paddingHorizontal: space[5], paddingTop: space[3], gap: 12, borderTopWidth: 1, borderTopColor: colors.lineLight, marginTop: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <PaymentPill id={payment} onPress={() => setMode('payment')} />
                  <Tap onPress={() => setMode('breakdown')} hitSlop={8}>
                    <Txt v="smallStrong" style={{ textDecorationLine: 'underline' }}>
                      {t('pax.ride.seeBreakdown')}
                    </Txt>
                  </Tap>
                </Row>
                <Button
                  label={t('pax.ride.request', { category: pricing.categories[ride.category].name })}
                  loading={requesting}
                  onPress={async () => {
                    // Without GPS the "current location" is only the city centre: ask for location
                    // or a chosen pickup first, so the driver isn't sent to the wrong place.
                    if (backendLive && ride.pickup.id === 'current' && location.status !== 'granted') {
                      await location.request();
                      toast(t('pax.ride.needPickup'), 'info');
                      setMode('pickup');
                      return;
                    }
                    setRequesting(true);
                    try {
                      await app.requestRide();
                    } catch (e) {
                      toast(e instanceof Error ? e.message : t('pax.ride.requestError'), 'warning');
                    } finally {
                      setRequesting(false);
                    }
                  }}
                  trailing={
                    <Txt v="title" tabular>
                      {cop(selected.finalFare)}
                    </Txt>
                  }
                />
              </View>
            </>
          ) : null}

          {mode === 'breakdown' ? (
            <View style={{ paddingHorizontal: space[5] }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: space[3] }}>
                <View>
                  <Txt v="h3">{t('pax.ride.breakdownTitle')}</Txt>
                  <Txt v="caption" color={colors.inkMuted}>
                    NÜVA {pricing.categories[selected.category].name} · {ride.pickup.area} → {ride.destination.area}
                  </Txt>
                </View>
              </Row>
              <FareBreakdownCard fare={selected} config={pricing} />
              <Button label={t('common.understood')} variant="dark" onPress={() => setMode('categories')} style={{ marginTop: space[4] }} />
            </View>
          ) : null}

          {mode === 'payment' ? (
            <View style={{ paddingHorizontal: space[5] }}>
              <Txt v="h3" style={{ marginBottom: space[3] }}>
                {t('pax.ride.howPay')}
              </Txt>
              {paymentMethodsFor(countryCode).map((m) => {
                const Icon = PAY_ICON[m.kind];
                const active = m.id === payment;
                return (
                  <Tap
                    key={m.id}
                    onPress={() => {
                      setPayment(m.id);
                      setMode('categories');
                    }}
                    accessibilityState={{ selected: active }}
                  >
                    <Row style={{ paddingVertical: 12, gap: 14 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: active ? colors.midnight : colors.ivory100, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={20} color={active ? colors.lime : colors.ink} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt v="bodyStrong">{paymentLabel(m.id, t)}</Txt>
                        <Txt v="caption" color={colors.inkMuted}>
                          {paymentDetail(m.id, t)}
                        </Txt>
                      </View>
                      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: active ? colors.midnight : colors.ivory400, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.midnight : 'transparent' }}>
                        {active ? <Check size={14} color={colors.lime} strokeWidth={3} /> : null}
                      </View>
                    </Row>
                  </Tap>
                );
              })}
            </View>
          ) : null}

          {mode === 'pickup' ? (
            <View style={{ paddingHorizontal: space[5] }}>
              <Txt v="h3">{t('pax.ride.wherePickup')}</Txt>
              <Txt v="caption" color={colors.inkMuted} style={{ marginBottom: space[3] }}>
                {t('pax.ride.pickupHint')}
              </Txt>
              {pickupOptions.map((p, i) => {
                const active = p.id === ride.pickup.id;
                return (
                  <Tap key={p.id} onPress={() => app.setPickup(p)} accessibilityState={{ selected: active }}>
                    <Row style={{ paddingVertical: 12, gap: 14, borderTopWidth: i ? 1 : 0, borderTopColor: colors.lineLight }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: active ? 6 : 2, borderColor: active ? colors.midnight : colors.ivory400 }} />
                      <View style={{ flex: 1 }}>
                        <Txt v="bodyStrong">{p.name}</Txt>
                        <Txt v="caption" color={colors.inkMuted}>
                          {p.address}
                          {' · '}
                          {i === 0
                            ? location.status === 'granted'
                              ? t('pax.ride.pickupGps')
                              : t('pax.ride.pickupNoGps')
                            : savedPlaces.places.some((s) => s.id === p.id)
                              ? t('pax.ride.pickupSaved')
                              : t('pax.ride.pickupChosen')}
                        </Txt>
                      </View>
                    </Row>
                  </Tap>
                );
              })}
              {/* Any address as pickup: works without GPS or saved places. */}
              <Button label={t('pax.ride.searchPickup')} icon={Search} variant="outline" size="md" onPress={() => router.push('/passenger/search?for=pickup')} style={{ marginTop: space[2] }} />
              <Button label={t('pax.ride.confirmPickup')} variant="dark" onPress={() => setMode('categories')} style={{ marginTop: space[3] }} />
            </View>
          ) : null}
        </Sheet>
      ) : null}

      {/* ── MATCHING ──────────────────────────────────────────── */}
      {phase === 'matching' ? (
        <Sheet stateKey="matching">
          <View style={{ paddingHorizontal: space[5], gap: space[4] }}>
            <Row style={{ gap: 12 }}>
              <LiveDot size={10} color={colors.midnight} />
              <Txt v="h2" style={{ flex: 1 }}>
                {t('pax.ride.searching')}
              </Txt>
            </Row>
            <ProgressBar value={matchP} />
            <Txt v="body" color={colors.inkMuted}>
              {live
                ? elapsed < 90
                  ? t('pax.ride.liveSent', { code: ride.tripCode ?? '' })
                  : t('pax.ride.liveBusy')
                : matchP < 0.35
                  ? t('pax.ride.simSending', { n: 6 })
                  : matchP < 0.7
                    ? t('pax.ride.simPriority')
                    : t('pax.ride.simAlmost')}
            </Txt>
            <Row style={{ justifyContent: 'space-between', padding: 14, borderRadius: radius.lg, backgroundColor: colors.ivory100 }}>
              <View>
                <Txt v="caption" color={colors.inkMuted}>
                  {t('pax.ride.closedPriceLine', { category: pricing.categories[ride.category].name })}
                </Txt>
                <Txt v="bodyStrong" numberOfLines={1}>
                  {ride.destination.name}
                </Txt>
              </View>
              <Money value={cop(fare.finalFare)} size={24} />
            </Row>
            <Button
              label={t('pax.ride.cancelRequest')}
              variant="outline"
              size="md"
              onPress={() => cancelActive(() => toast(t('pax.ride.requestCancelled'), 'info'), true)}
            />
          </View>
        </Sheet>
      ) : null}

      {/* ── DRIVER ASSIGNED / ARRIVING / IN TRIP ─────────────── */}
      {(phase === 'assigned' || phase === 'arriving' || phase === 'in-trip') && ride.driver ? (
        <Sheet stateKey={phase}>
          <View style={{ paddingHorizontal: space[5] }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: space[4] }}>
              <View style={{ flex: 1 }}>
                <Txt v="overline" color={phase === 'arriving' ? colors.limeInk : colors.inkMuted}>
                  {phase === 'assigned' ? t('pax.ride.driverOnWay') : phase === 'arriving' ? t('pax.ride.driverArrived') : t('common.inTrip')}
                </Txt>
                <Txt v="h1" style={{ marginTop: 4 }}>
                  {phase === 'assigned'
                    ? t('pax.ride.arrivesIn', { min: approachLeft })
                    : phase === 'arriving'
                      ? t('pax.ride.waiting')
                      : t('pax.ride.youArrive', { time: clock(arrival) })}
                </Txt>
              </View>
              {phase !== 'in-trip' ? (
                <View style={{ alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.midnight }}>
                  <Txt v="caption" color={colors.onDarkMuted}>
                    PIN
                  </Txt>
                  <Txt style={{ fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: 2 }} color={colors.lime} tabular>
                    {live ? (boardingPin ?? '····') : '4821'}
                  </Txt>
                </View>
              ) : (
                <Txt v="h3" tabular color={colors.inkMuted}>
                  {t('common.minutesShort', { n: remainingMin })}
                </Txt>
              )}
            </Row>
            {phase === 'in-trip' ? (
              <View style={{ marginBottom: space[4] }}>
                <ProgressBar value={tripP} height={8} />
                <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
                  <Txt v="caption" color={colors.inkMuted} numberOfLines={1} style={{ flex: 1 }}>
                    {ride.pickup.area}
                  </Txt>
                  <Txt v="caption" numberOfLines={1}>
                    {ride.destination.name}
                  </Txt>
                </Row>
              </View>
            ) : null}

            <Row style={{ gap: 14, padding: 14, borderRadius: radius.lg, backgroundColor: colors.ivory100 }}>
              <Avatar initials={ride.driver.initials} size={52} bg={ride.driver.tone} />
              <View style={{ flex: 1 }}>
                <Txt v="title" numberOfLines={1}>
                  {ride.driver.name.split(' ').slice(0, 2).join(' ')}
                </Txt>
                <Row style={{ gap: 6, marginTop: 2 }}>
                  <Star size={13} color={colors.ink} fill={colors.ink} />
                  <Txt v="caption" tabular>
                    {ride.driver.rating.toFixed(2).replace('.', ',')}
                    {/* Live counterparts don't carry a trip count: show it only when known. */}
                    {ride.driver.trips ? ` · ${t(ride.driver.trips === 1 ? 'common.tripsCountOne' : 'common.tripsCount', { n: num(ride.driver.trips) })}` : ''}
                  </Txt>
                </Row>
                <Txt v="caption" color={colors.inkMuted} numberOfLines={1}>
                  {ride.driver.car} · {ride.driver.color}
                </Txt>
              </View>
              <Plate plate={ride.driver.plate} region={countryCode === 'CW' ? 'CURAÇAO' : 'COLOMBIA'} />
            </Row>

            <Row style={{ gap: 10, marginTop: space[4] }}>
              {phase === 'in-trip' ? (
                <>
                  <Button label={t('common.shareTrip')} icon={Share2} variant="outline" size="md" full={false} style={{ flex: 1 }} onPress={shareTrip} />
                  <Button label="SOS" icon={ShieldAlert} variant="danger" size="md" full={false} onPress={() => router.push('/passenger/safety')} />
                </>
              ) : live ? (
                // Live: trip chat (stored with the trip) and a direct call — the server only
                // shares the driver's phone while the trip is active.
                <>
                  <Button
                    label={chat.unread ? `${t('common.message')} · ${chat.unread}` : t('common.message')}
                    icon={MessageCircle}
                    variant={chat.unread ? 'dark' : 'outline'}
                    size="md"
                    full={false}
                    style={{ flex: 1 }}
                    onPress={() => setChatOpen(true)}
                  />
                  <Button
                    label={t('common.call')}
                    icon={Phone}
                    variant="outline"
                    size="md"
                    full={false}
                    style={{ flex: 1 }}
                    onPress={() => {
                      const phone = ride.driver?.phone;
                      if (!phone) return toast(t('chat.noPhone'), 'info');
                      Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => toast(t('chat.noPhone'), 'info'));
                    }}
                  />
                  <IconButton icon={Share2} label={t('common.shareTrip')} onPress={shareTrip} size={48} />
                </>
              ) : (
                <>
                  <Button label={t('common.message')} icon={MessageCircle} variant="outline" size="md" full={false} style={{ flex: 1 }} onPress={() => toast(t('pax.ride.secureChat'), 'info')} />
                  <Button
                    label={t('common.call')}
                    icon={Phone}
                    variant="outline"
                    size="md"
                    full={false}
                    style={{ flex: 1 }}
                    onPress={() => toast(t('pax.ride.maskedCallToast', { phone: ride.driver!.phoneMasked }), 'info')}
                  />
                  <IconButton icon={Share2} label={t('common.shareTrip')} onPress={shareTrip} size={48} />
                </>
              )}
            </Row>
            {phase === 'assigned' ? (
              <Tap
                onPress={() =>
                  cancelActive(() => {
                    router.navigate('/passenger/home');
                    toast(t('pax.ride.tripCancelled'), 'info');
                  })
                }
                style={{ alignSelf: 'center', marginTop: space[3], padding: 6 }}
              >
                <Txt v="smallStrong" color={colors.inkMuted}>
                  {t('pax.ride.cancelTrip')}
                </Txt>
              </Tap>
            ) : null}
          </View>
        </Sheet>
      ) : null}

      {/* ── COMPLETED + RATING ───────────────────────────────── */}
      {phase === 'completed' ? (
        <Sheet stateKey="completed">
          <ScrollView style={{ maxHeight: 640 }} contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
            <Row style={{ gap: 12 }}>
              <Animated.View entering={ZoomIn.springify()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
                <Check size={24} color={colors.midnight} strokeWidth={3} />
              </Animated.View>
              <View style={{ flex: 1 }}>
                <Txt v="overline" color={colors.inkMuted}>
                  {t('pax.ride.completedAt', { time: clock(ride.completedAt ?? new Date()) })}
                </Txt>
                <Txt v="h3" numberOfLines={2}>
                  {t('pax.ride.arrivedAt', { place: ride.destination.name })}
                </Txt>
              </View>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: space[4], padding: 16, borderRadius: radius.lg, backgroundColor: colors.ivory100 }}>
              <View>
                <Txt v="caption" color={colors.inkMuted}>
                  {t(live ? 'pax.ride.payWith' : 'pax.ride.paidWith', { method: paymentLabel(ride.payment, t) })}
                </Txt>
                <Txt v="caption" color={colors.inkMuted}>
                  {km(fare.distanceKm)} · {minutes(fare.durationMin)}
                </Txt>
              </View>
              <Money value={cop(fare.finalFare + tip)} size={28} />
            </Row>

            {/* Every payment goes straight to the driver: show exactly how. */}
            {live ? (
              <View style={{ marginTop: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.midnight, gap: 4 }}>
                <Txt v="caption" color={colors.onDarkMuted}>
                  {t('pax.ride.payDirect', { name: ride.driver?.name.split(' ')[0] ?? t('pax.ride.yourDriver') })}
                </Txt>
                <Txt v="title" color={colors.ivory}>
                  {payInstruction(t, ride.payment, cop(fare.finalFare + tip), ride.driverNequi)}
                </Txt>
                <Txt v="caption" color={colors.onDarkFaint}>
                  {t('pax.ride.driverConfirms')}
                </Txt>
              </View>
            ) : null}

            <Txt v="h3" align="center" style={{ marginTop: space[5] }}>
              {t('pax.ride.howWasIt', { name: ride.driver?.name.split(' ')[0] ?? t('pax.ride.yourDriver') })}
            </Txt>
            <Row style={{ justifyContent: 'center', gap: 6, marginTop: space[3] }} accessibilityRole="adjustable" accessibilityLabel={t('pax.ride.ratingA11y', { n: stars })}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Tap key={s} onPress={() => setStars(s)} accessibilityLabel={t('common.starsCount', { n: s })} scaleTo={0.85}>
                  <Star size={38} color={s <= stars ? colors.midnight : colors.ivory400} fill={s <= stars ? colors.lime : 'transparent'} strokeWidth={1.6} />
                </Tap>
              ))}
            </Row>
            <Row style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: space[4] }}>
              {RATING_TAGS_PASSENGER.map((tag) => (
                <Chip
                  key={tag}
                  label={t(tag)}
                  active={tags.includes(tag)}
                  onPress={() => setTags((l) => (l.includes(tag) ? l.filter((x) => x !== tag) : [...l, tag]))}
                />
              ))}
            </Row>
            <Txt v="overline" color={colors.inkMuted} style={{ marginTop: space[5], marginBottom: 8 }}>
              {t('pax.ride.tipTitle')}
            </Txt>
            <Row style={{ gap: 8 }}>
              {(countryCode === 'CW' ? [0, 200, 300, 500] : [0, 2000, 3000, 5000]).map((v) => (
                <Chip key={v} label={v ? cop(v) : t('pax.ride.tipNone')} active={tip === v} onPress={() => setTip(v)} style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 6 }} />
              ))}
            </Row>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('pax.ride.notePh')}
              placeholderTextColor={colors.stone}
              accessibilityLabel={t('pax.ride.noteA11y')}
              multiline
              style={[{ marginTop: space[4], minHeight: 64, borderRadius: radius.md, backgroundColor: colors.ivory100, padding: 14, fontFamily: fonts.medium, fontSize: 15, color: colors.ink }, { outlineStyle: 'none' } as object]}
            />
            <Button
              label={t('pax.ride.sendRating')}
              onPress={() => {
                // Tags are stored as their dictionary keys (language-neutral); the comment as typed.
                app.rateRide(stars, tip, tags, note);
              }}
              style={{ marginTop: space[4] }}
            />
          </ScrollView>
        </Sheet>
      ) : null}

      {phase === 'rated' ? (
        <Sheet stateKey="rated">
          <View style={{ paddingHorizontal: space[5], alignItems: 'center', paddingTop: space[4] }}>
            <Animated.View entering={ZoomIn.springify()} style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center' }}>
              <Stars value={ride.rating ?? 5} size={12} color={colors.lime} empty={colors.midnight500} />
              <Txt style={{ fontFamily: fonts.extrabold, fontSize: 24 }} color={colors.ivory}>
                {ride.rating}
              </Txt>
            </Animated.View>
            <Animated.View entering={FadeIn.delay(200)}>
              <Txt v="h2" align="center" style={{ marginTop: space[4] }}>
                {t('pax.ride.thanks', { name: (live ? profile?.full_name?.split(' ')[0] : 'Valentina') || '' })}
              </Txt>
              <Txt v="body" align="center" color={colors.inkMuted} style={{ marginTop: 6 }}>
                {ride.tip ? `${t('pax.ride.tipArrives', { amount: cop(ride.tip), name: ride.driver?.name.split(' ')[0] ?? t('pax.ride.yourDriver') })} ` : ''}
                {t('pax.ride.receiptReady')}
              </Txt>
            </Animated.View>
            <Divider style={{ alignSelf: 'stretch', marginVertical: space[5] }} />
            <Row style={{ alignSelf: 'stretch', justifyContent: 'space-between' }}>
              <Txt v="body" color={colors.inkMuted}>
                {t('pax.ride.totalPaid')}
              </Txt>
              <Txt v="title" tabular>
                {cop(fare.finalFare + (ride.tip ?? 0))}
              </Txt>
            </Row>
            <Button label={t('common.backHome')} onPress={exit} style={{ marginTop: space[5], alignSelf: 'stretch' }} />
          </View>
        </Sheet>
      ) : null}

      {chatTripId && session ? (
        <TripChat
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
          tripId={chatTripId}
          myId={session.user.id}
          otherName={ride.driver?.name.split(' ').slice(0, 2).join(' ') ?? t('pax.ride.yourDriver')}
          messages={chat.messages}
        />
      ) : null}
    </View>
  );
}
