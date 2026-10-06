import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  MessageCircle,
  Phone,
  ShieldAlert,
  Star,
  X,
} from 'lucide-react-native';
import { Ring } from '../../components/charts/Charts';
import { FareBreakdownCard } from '../../components/fare/FareBreakdownCard';
import { CityMap } from '../../components/map/CityMap';
import { CarMarker, PlacePin } from '../../components/map/Markers';
import { Button, haptic, IconButton, Tap } from '../../components/ui/Button';
import { Avatar, Badge, Divider, ProgressBar, Row } from '../../components/ui/primitives';
import { Sheet } from '../../components/ui/Sheet';
import { useStatusTone, useToast } from '../../components/ui/Screen';
import { Money, Txt } from '../../components/ui/Txt';
import { addMinutes, clock, cop, decimal, km, minutes } from '../../lib/format';
import { instructions, NavStep, pathLength, pointAlong, project, Pt, unproject } from '../../lib/geo';
import { useLocation } from '../../lib/location';
import { fetchRoute } from '../../lib/routing';
import { OFF_ROUTE_M, snapToRoute, useGlide } from '../../lib/carMotion';
import { useCountdown, useProgress } from '../../lib/hooks';
import { useT } from '../../i18n';
import { paymentLabel } from '../../data/mock';
import { acceptTrip, advanceTrip, cancelTrip, confirmDirectPayment, fetchCounterpart, fetchTrip, PIN_WRONG, presenceOwner, setPresence, watchTrip } from '../../lib/liveTrips';
import { useCountry } from '../../lib/country';
import { TripChat, useTripChat } from '../../components/trip/TripChat';
import { createRequest, DRIVER_LOCATION, requestFromTrip, RideRequest } from '../../lib/requests';
import { sumTrips, todayTrips, useApp } from '../../store/AppStore';
import { useAuth } from '../../store/Auth';
import { colors, fonts, radius, space } from '../../theme/tokens';

type Phase = 'request' | 'expired' | 'pickup' | 'arrived' | 'trip' | 'complete';
const REQUEST_SECONDS = 15;

const TURN_ICON = { left: CornerUpLeft, right: CornerUpRight, straight: ArrowUp, arrive: Flag };

/** Fraction (0–1) of the route already covered, from the vertex nearest to `p`. */
function nearestFraction(route: Pt[], p: Pt) {
  if (route.length < 2) return 0;
  let best = Infinity;
  let at = 0;
  let acc = 0;
  for (let i = 0; i < route.length; i++) {
    if (i) acc += Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
    const d = Math.hypot(route[i].x - p.x, route[i].y - p.y);
    if (d < best) {
      best = d;
      at = acc;
    }
  }
  return acc ? Math.min(1, at / acc) : 0;
}

function NavBanner({ route, progress, navSteps }: { route: Pt[]; progress: number; navSteps?: NavStep[] }) {
  const t = useT();
  const steps = useMemo(() => (navSteps?.length ? navSteps : instructions(route)), [route, navSteps]);
  const next = steps.find((s) => s.atFraction > progress + 0.001) ?? steps[steps.length - 1];
  const meters = Math.max(0, Math.round(((next.atFraction - progress) * pathLength(route) * 10) / 10) * 10);
  const Icon = TURN_ICON[next.dir];
  return (
    <Animated.View entering={FadeInDown} style={{ backgroundColor: colors.lime, borderRadius: radius.xl, padding: space[4], flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={28} color={colors.lime} strokeWidth={2.6} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt style={{ fontFamily: fonts.extrabold, fontSize: 26, letterSpacing: -0.8 }} color={colors.midnight} tabular>
          {next.dir === 'arrive' ? `${meters} m` : meters >= 1000 ? `${decimal(meters / 1000, 1)} km` : `${meters} m`}
        </Txt>
        <Txt v="smallStrong" color={colors.midnight} numberOfLines={1}>
          {/* Steps carry a dictionary key; `text` (Spanish) only covers steps stored by older versions. */}
          {next.key ? t(next.key) : next.text}
          {next.street ? ` · ${next.street}` : ''}
        </Txt>
      </View>
    </Animated.View>
  );
}

/** Entry: a real server trip (?trip=) or a simulated request (?seed=). */
export default function DriverRide() {
  const { seed, trip } = useLocalSearchParams<{ seed?: string; trip?: string }>();
  const { pricing } = useApp();
  const toast = useToast();
  const t = useT();
  const [liveReq, setLiveReq] = useState<RideRequest | null>(null);
  const [resume, setResume] = useState<{ phase: Phase; startedAt?: Date }>({ phase: 'request' });
  const location = useLocation();
  const { session } = useAuth();

  useEffect(() => {
    if (!trip) return;
    const from = location.status === 'granted' ? location.here : DRIVER_LOCATION;
    fetchTrip(trip)
      .then(async (row) => {
        // A trip this driver already took (app closed, back pressed…) reopens where it was.
        const mine = !!session && row.driver_id === session.user.id && ['accepted', 'arriving', 'in_progress'].includes(row.status);
        if (row.status !== 'requested' && !mine) {
          toast(t('drv.ride.unavailable'), 'info');
          close();
          return;
        }
        const base = requestFromTrip(row, from);
        // Real street routes (OSRM) for the approach and the trip; estimate on failure.
        const [a, r, cp] = await Promise.all([
          fetchRoute(from, base.pickup),
          fetchRoute(base.pickup, base.destination),
          mine ? fetchCounterpart(row.id).catch(() => null) : Promise.resolve(null),
        ]);
        setResume({
          phase: row.status === 'accepted' ? 'pickup' : row.status === 'arriving' ? 'arrived' : row.status === 'in_progress' ? 'trip' : 'request',
          startedAt: row.started_at ? new Date(row.started_at) : undefined,
        });
        setLiveReq({
          ...base,
          ...(cp ? { passenger: cp.name, passengerRating: Number(cp.rating) || 5 } : {}),
          approach: a.points,
          approachSteps: a.steps,
          route: r.points,
          routeSteps: r.steps,
          pickupKm: a.distanceKm,
          pickupMin: Math.max(1, a.durationMin),
        });
      })
      .catch(() => {
        toast(t('drv.ride.loadError'), 'warning');
        close();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip]);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/driver/home'));

  if (trip) {
    if (!liveReq) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.lime} />
        </View>
      );
    }
    return <DriverRideView initialReq={liveReq} liveTripId={trip} initialPhase={resume.phase} startedAt={resume.startedAt} />;
  }
  // Priced once with the live config when the request arrives — later rate edits don't change an offer in progress.
  return <DriverRideView initialReq={createRequest(Number(seed ?? 4242) || 4242, pricing)} />;
}

function DriverRideView({ initialReq, liveTripId, initialPhase = 'request', startedAt }: { initialReq: RideRequest; liveTripId?: string; initialPhase?: Phase; startedAt?: Date }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const t = useT();
  const { pricing, addDriverTrip, driverTrips } = useApp();
  const { session } = useAuth();
  const { code: countryCode } = useCountry();
  const [req, setReq] = useState(initialReq);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const live = !!liveTripId;
  // Contact with the passenger once the trip is ours: trip chat and their phone
  // (the server only shares it while the trip is active).
  const onTrip = live && (phase === 'pickup' || phase === 'arrived' || phase === 'trip');
  const [chatOpen, setChatOpen] = useState(false);
  const chat = useTripChat(onTrip ? liveTripId : undefined, session?.user.id, chatOpen);
  const [passengerPhone, setPassengerPhone] = useState<string | null>(null);
  useEffect(() => {
    if (!onTrip || passengerPhone) return;
    fetchCounterpart(liveTripId!)
      .then((cp) => {
        if (!cp) return;
        setPassengerPhone(cp.phone ?? null);
        setReq((cur) => ({ ...cur, passenger: cp.name, passengerRating: Number(cp.rating) || 5 }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTrip]);
  const [pin, setPin] = useState('');
  const [stars, setStars] = useState(5);
  const [tripStart, setTripStart] = useState(() => startedAt ?? new Date());
  const [todayBefore] = useState(() => sumTrips(todayTrips(driverTrips)).net);
  useStatusTone('light');

  // Paused while the accept is in flight, so it can't expire under the driver's finger.
  const left = useCountdown(REQUEST_SECONDS, phase === 'request' && !busy, req.id, () => {
    haptic('warning');
    setPhase('expired');
  });
  const pickupSim = useProgress(9000, phase === 'pickup', req.id);
  const waitS = useCountdown(300, phase === 'arrived', req.id);
  const tripSim = useProgress(16000, phase === 'trip', req.id);
  const location = useLocation();
  // Live trips with GPS follow the real phone; otherwise the car is simulated along the route.
  const gps = live && location.status === 'granted';
  const gpsPt = { ...project(location.here), heading: location.heading };
  // GPS snapped onto the street being driven, so the car rides the road instead of drifting over blocks.
  const activeRoute = phase === 'pickup' ? req.approach : phase === 'trip' ? req.route : null;
  const snap = gps && activeRoute ? snapToRoute(activeRoute, gpsPt) : null;
  const onRoute = !!snap && snap.offM < OFF_ROUTE_M;
  const pickupP = gps ? (phase === 'pickup' && onRoute && snap ? snap.fraction : nearestFraction(req.approach, gpsPt)) : pickupSim;
  const tripP = gps ? (phase === 'trip' && onRoute && snap ? snap.fraction : nearestFraction(req.route, gpsPt)) : tripSim;
  const gpsCar = useGlide(gps ? (onRoute && snap ? { ...snap.pt, heading: snap.heading } : gpsPt) : null);

  // Demo requests: swap the instant estimate for real streets (OSRM) as soon as they load.
  useEffect(() => {
    if (live) return;
    let alive = true;
    Promise.all([fetchRoute(DRIVER_LOCATION, req.pickup), fetchRoute(req.pickup, req.destination)]).then(([a, r]) => {
      if (!alive) return;
      setReq((cur) => ({ ...cur, approach: a.points, approachSteps: a.steps, route: r.points, routeSteps: r.steps, pickupKm: a.distanceKm, pickupMin: Math.max(1, a.durationMin) }));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Off the suggested way to the pickup: re-route from where the driver really is (at most every 15 s).
  const lastReroute = useRef(0);
  useEffect(() => {
    if (!gps || phase !== 'pickup' || !snap || onRoute || Date.now() - lastReroute.current < 15_000) return;
    lastReroute.current = Date.now();
    fetchRoute(location.here, req.pickup).then((a) => {
      if (a.source === 'street') setReq((cur) => ({ ...cur, approach: a.points, approachSteps: a.steps }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps, phase, location.here.lat, location.here.lng]);

  const car = gps && gpsCar
    ? gpsCar
    : phase === 'pickup'
      ? pointAlong(req.approach, pickupP)
      : phase === 'trip'
        ? pointAlong(req.route, tripP)
        : phase === 'arrived'
          ? { ...project(req.pickup), heading: 0 }
          : { ...project(DRIVER_LOCATION), heading: 20 };
  const fare = req.fare;
  const c = pricing.categories[req.category];

  const close = () => (router.canGoBack() ? router.back() : router.replace('/driver/home'));

  /** Runs a server step in live mode; demo mode just moves on. */
  const step = async (fn: () => Promise<unknown>, next: Phase) => {
    if (!live) return setPhase(next);
    setBusy(true);
    try {
      await fn();
      setPhase(next);
      // Once accepted, the server shares the passenger's real name and rating.
      if (next === 'pickup') {
        fetchCounterpart(liveTripId!)
          .then((cp) => cp && setReq((cur) => ({ ...cur, passenger: cp.name, passengerRating: Number(cp.rating) || 5 })))
          .catch(() => {});
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      toast(msg === PIN_WRONG ? t('drv.ride.pinWrong') : msg || t('drv.ride.updateError'), 'warning');
      if (next === 'pickup') close();
    } finally {
      setBusy(false);
    }
  };

  /** Driver backs out before the passenger boards (two taps, so it isn't accidental). */
  const cancelRide = async () => {
    if (!confirmCancel) {
      setConfirmCancel(true);
      setTimeout(() => setConfirmCancel(false), 4000);
      return;
    }
    if (live) {
      setBusy(true);
      try {
        await cancelTrip(liveTripId!);
      } catch (e) {
        toast(e instanceof Error ? e.message : t('drv.ride.updateError'), 'warning');
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    toast(t('drv.ride.cancelled'), 'info');
    close();
  };

  const complete = async () => {
    if (live) {
      await step(() => advanceTrip(liveTripId!, 'completed'), 'complete');
    } else {
      addDriverTrip({ id: `DT-live-${Date.now()}`, passenger: req.passenger, from: req.pickup, to: req.destination, date: new Date(), fare });
      setPhase('complete');
    }
    haptic('success');
  };

  // Live: share the car position so the passenger sees it move; react to cancellations.
  const carRef = useRef(car);
  carRef.current = car;
  // Only real GPS is shared: without it the passenger sees no car rather than a simulated one.
  const gpsRef = useRef(gps);
  gpsRef.current = gps;
  useEffect(() => {
    if (!live || !session || (phase !== 'pickup' && phase !== 'arrived' && phase !== 'trip')) return;
    presenceOwner.ride = true; // the dashboard heartbeat steps aside while a trip is on
    const send = () => {
      const ll = unproject(carRef.current);
      setPresence(session.user.id, true, gpsRef.current ? { lat: ll.lat, lng: ll.lng, heading: carRef.current.heading } : undefined).catch(() => {});
    };
    send();
    const id = setInterval(send, 2000);
    return () => {
      clearInterval(id);
      presenceOwner.ride = false;
    };
  }, [live, session, phase]);

  useEffect(() => {
    if (!liveTripId) return;
    return watchTrip(liveTripId, (row) => {
      if (row.status === 'cancelled') {
        toast(t('drv.ride.passengerCancelled'), 'warning');
        close();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTripId]);

  const focus =
    phase === 'request' || phase === 'expired'
      ? [...req.approach, ...req.route]
      : phase === 'pickup'
        ? req.approach
        : phase === 'arrived'
          ? [project(req.pickup)]
          : phase === 'trip'
            ? req.route
            : [project(req.destination)];

  const sheetH = phase === 'request' ? 470 : phase === 'complete' ? 620 : 300;

  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight }}>
      <CityMap
        theme="dark"
        focus={focus}
        minSpan={phase === 'pickup' || phase === 'trip' ? 120 : 160}
        insets={{ top: insets.top + (phase === 'pickup' || phase === 'trip' ? 150 : 90), bottom: sheetH + 20, left: 50, right: 50 }}
        route={phase === 'pickup' ? req.approach : phase === 'trip' || phase === 'request' || phase === 'expired' ? req.route : undefined}
        progress={phase === 'pickup' ? pickupP : phase === 'trip' ? tripP : 0}
        renderMarkers={(toScreen) => (
          <>
            {phase === 'request' || phase === 'pickup' || phase === 'arrived' || phase === 'expired' ? (
              <PlacePin pos={toScreen(req.pickup)} kind="pickup" tone="dark" title={phase === 'request' ? t('drv.ride.pickupPin', { min: req.pickupMin }) : undefined} />
            ) : null}
            {phase === 'request' || phase === 'trip' || phase === 'expired' ? <PlacePin pos={toScreen(req.destination)} kind="dropoff" tone="dark" title={phase === 'request' ? req.destination.area : undefined} /> : null}
            {phase !== 'complete' ? <CarMarker pos={toScreen(car)} heading={car.heading} tone="lime" size={38} /> : null}
          </>
        )}
      />

      <View style={{ position: 'absolute', top: insets.top + 8, left: space[4], right: space[4], gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          {phase === 'request' || phase === 'expired' || phase === 'complete' ? (
            <IconButton icon={ArrowLeft} label={t('common.backHome')} tone="dark" size={46} onPress={close} />
          ) : (
            <Row style={{ gap: 8, backgroundColor: colors.midnight700, borderRadius: radius.pill, paddingHorizontal: 14, height: 40, borderWidth: 1, borderColor: colors.lineDarkStrong }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime }} />
              <Txt v="smallStrong" color={colors.ivory}>
                {t('drv.ride.statusPill', {
                  status: phase === 'pickup' ? t('drv.ride.toPickup') : phase === 'arrived' ? t('drv.ride.atPoint') : t('common.inTrip'),
                  category: c.name,
                })}
              </Txt>
            </Row>
          )}
          {phase === 'pickup' || phase === 'trip' ? (
            <IconButton
              icon={ShieldAlert}
              label={t('drv.ride.emergency')}
              tone="dark"
              size={44}
              onPress={() => {
                // Real emergency line of the country (123 Colombia, 911 Curaçao).
                Linking.openURL(`tel:${countryCode === 'CW' ? '911' : '123'}`).catch(() => toast(t('drv.ride.safetyTeam'), 'warning'));
              }}
            />
          ) : null}
        </Row>
        {phase === 'pickup' ? <NavBanner route={req.approach} progress={pickupP} navSteps={req.approachSteps} /> : null}
        {phase === 'trip' ? <NavBanner route={req.route} progress={tripP} navSteps={req.routeSteps} /> : null}
      </View>

      {/* ── Incoming request ─────────────────────────────── */}
      {phase === 'request' ? (
        <Sheet tone="dark" stateKey="request">
          <View style={{ paddingHorizontal: space[5] }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Row style={{ gap: 8 }}>
                  <Txt v="overline" color={colors.lime}>
                    {t('drv.ride.newRequest')}
                  </Txt>
                  <Badge label={`NÜVA ${c.name}`} tone="ghostDark" />
                </Row>
                <Txt v="caption" color={colors.onDarkMuted} style={{ marginTop: 10 }}>
                  {t('drv.ride.yourNet')}
                </Txt>
                <Money value={cop(fare.driverEarnings)} size={46} color={colors.lime} />
              </View>
              <Ring size={72} progress={left / REQUEST_SECONDS} color={left < 5 ? colors.warning : colors.lime}>
                <Txt style={{ fontFamily: fonts.extrabold, fontSize: 22 }} color={colors.ivory} tabular accessibilityLabel={t('drv.ride.secondsLeft', { n: Math.ceil(left) })}>
                  {Math.ceil(left)}
                </Txt>
              </Ring>
            </Row>

            <Row style={{ marginTop: 10, gap: 14 }}>
              <Txt v="small" color={colors.onDarkMuted} tabular>
                {t('drv.ride.fare', { amount: cop(fare.finalFare) })}
              </Txt>
              <Txt v="small" color={colors.onDarkMuted} tabular>
                {t('drv.ride.commissionLine', { pct: decimal(fare.commissionPct, fare.commissionPct % 1 ? 1 : 0), amount: cop(fare.platformCommission) })}
              </Txt>
            </Row>
            {req.discount ? (
              // Promo: the driver still earns on the full fare — part in cash, part credited by NÜVA.
              <Txt v="small" color={colors.lime} style={{ marginTop: 6 }}>
                {t('drv.ride.promoLine', { cash: cop(fare.finalFare - req.discount), credit: cop(req.discount) })}
              </Txt>
            ) : null}

            <View style={{ marginTop: space[4], borderRadius: radius.lg, backgroundColor: colors.midnight700, padding: 14, gap: 12 }}>
              <Row>
                {[
                  { k: t('common.pickup'), v: t('common.minutesShort', { n: req.pickupMin }), s: km(req.pickupKm) },
                  { k: t('common.trip'), v: km(fare.distanceKm), s: minutes(fare.durationMin) },
                  { k: t('common.destination'), v: req.destination.area, s: paymentLabel(req.payment, t) },
                ].map((d, i) => (
                  <View key={d.k} style={{ flex: 1, paddingLeft: i ? 12 : 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.lineDark }}>
                    <Txt v="caption" color={colors.onDarkFaint}>
                      {d.k}
                    </Txt>
                    <Txt v="title" color={colors.ivory} numberOfLines={1}>
                      {d.v}
                    </Txt>
                    <Txt v="caption" color={colors.onDarkMuted} numberOfLines={1}>
                      {d.s}
                    </Txt>
                  </View>
                ))}
              </Row>
              <Divider tone="dark" />
              <Row style={{ gap: 10 }}>
                <Avatar initials={req.passenger.slice(0, 1) + req.passenger.split(' ')[1]?.[0]} size={34} bg={colors.midnight500} fg={colors.ivory} />
                <Txt v="smallStrong" color={colors.ivory} style={{ flex: 1 }}>
                  {req.passenger}
                </Txt>
                <Star size={13} color={colors.lime} fill={colors.lime} />
                <Txt v="smallStrong" color={colors.ivory} tabular>
                  {decimal(req.passengerRating, 2)}
                </Txt>
              </Row>
            </View>

            <Row style={{ gap: 10, marginTop: space[4] }}>
              <Button
                label={t('drv.ride.reject')}
                icon={X}
                variant="outlineDark"
                full={false}
                style={{ flex: 1 }}
                onPress={() => {
                  toast(t('drv.ride.rejected'), 'info');
                  close();
                }}
              />
              <Button
                label={t('drv.ride.accept')}
                icon={Check}
                full={false}
                style={{ flex: 1.6 }}
                loading={busy}
                onPress={() => {
                  haptic('success');
                  step(() => acceptTrip(liveTripId!), 'pickup');
                }}
              />
            </Row>
          </View>
        </Sheet>
      ) : null}

      {phase === 'expired' ? (
        <Sheet tone="dark" stateKey="expired">
          <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
            <Txt v="h2" color={colors.ivory}>
              {t('drv.ride.expiredTitle')}
            </Txt>
            <Txt v="body" color={colors.onDarkMuted}>
              {t('drv.ride.expiredBody')}
            </Txt>
            <Button label={t('drv.ride.findMore')} onPress={close} />
          </View>
        </Sheet>
      ) : null}

      {/* ── To pickup / arrived / on trip ─────────────────── */}
      {phase === 'pickup' || phase === 'arrived' || phase === 'trip' ? (
        <Sheet tone="dark" stateKey={phase}>
          <View style={{ paddingHorizontal: space[5] }}>
            <Row style={{ gap: 12 }}>
              <Avatar initials={req.passenger.slice(0, 1) + (req.passenger.split(' ')[1]?.[0] ?? '')} size={48} bg={colors.midnight500} fg={colors.ivory} />
              <View style={{ flex: 1 }}>
                <Txt v="title" color={colors.ivory}>
                  {phase === 'trip' ? t('drv.ride.carrying', { name: req.passenger }) : req.passenger}
                </Txt>
                <Txt v="caption" color={colors.onDarkMuted} numberOfLines={1}>
                  {phase === 'trip' ? t('drv.ride.arrivalAt', { place: req.destination.name, time: clock(addMinutes(tripStart, fare.durationMin)) }) : `${req.pickup.address} · ${paymentLabel(req.payment, t)}`}
                </Txt>
              </View>
              {phase !== 'trip' ? (
                <Row style={{ gap: 8 }}>
                  <IconButton
                    icon={MessageCircle}
                    label={t('drv.ride.messagePassenger')}
                    tone={chat.unread ? 'lime' : 'dark'}
                    size={44}
                    badge={chat.unread > 0}
                    onPress={() => (live ? setChatOpen(true) : toast(t('drv.ride.quickMessage'), 'info'))}
                  />
                  <IconButton
                    icon={Phone}
                    label={t('drv.ride.callPassenger')}
                    tone="dark"
                    size={44}
                    onPress={() => {
                      if (!live) return toast(t('drv.ride.maskedCallStarted'), 'info');
                      if (!passengerPhone) return toast(t('chat.noPhone'), 'info');
                      Linking.openURL(`tel:${passengerPhone.replace(/[^\d+]/g, '')}`).catch(() => toast(t('chat.noPhone'), 'info'));
                    }}
                  />
                </Row>
              ) : null}
            </Row>

            {phase === 'pickup' ? (
              <View style={{ marginTop: space[4], gap: space[3] }}>
                <ProgressBar value={pickupP} tone="dark" />
                <Button
                  label={pickupP >= 1 || gps ? t('drv.ride.arrived') : t('drv.ride.arriving', { min: Math.max(1, Math.round(req.pickupMin * (1 - pickupP))) })}
                  disabled={!gps && pickupP < 1}
                  loading={busy}
                  onPress={() => step(() => advanceTrip(liveTripId!, 'arriving'), 'arrived')}
                />
                <Button label={confirmCancel ? t('drv.ride.cancelConfirm') : t('drv.ride.cancelTrip')} variant="outlineDark" size="md" disabled={busy} onPress={cancelRide} />
              </View>
            ) : null}

            {phase === 'arrived' ? (
              <View style={{ marginTop: space[4], gap: space[3] }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt v="small" color={colors.onDarkMuted}>
                    {t('drv.ride.freeWait')}
                  </Txt>
                  <Txt v="smallStrong" color={colors.ivory} tabular>
                    {Math.floor(waitS / 60)}:{Math.floor(waitS % 60).toString().padStart(2, '0')}
                  </Txt>
                </Row>
                <Row style={{ gap: 10 }}>
                  <TextInput
                    value={pin}
                    onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
                    placeholder={t('drv.ride.pinPh')}
                    placeholderTextColor={colors.onDarkFaint}
                    keyboardType="number-pad"
                    accessibilityLabel={t('drv.ride.pinA11y')}
                    style={[{ flex: 1, height: 58, borderRadius: radius.pill, backgroundColor: colors.midnight700, paddingHorizontal: 20, fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: 4, color: colors.ivory, borderWidth: 1.5, borderColor: pin.length === 4 ? colors.lime : colors.lineDarkStrong }, { outlineStyle: 'none' } as object]}
                  />
                  <Button
                    label={t('drv.ride.start')}
                    iconRight={ArrowRight}
                    full={false}
                    disabled={pin.length < 4}
                    loading={busy}
                    onPress={() => {
                      setTripStart(new Date());
                      step(() => advanceTrip(liveTripId!, 'in_progress', pin), 'trip');
                    }}
                  />
                </Row>
                <Txt v="caption" color={colors.onDarkFaint}>
                  {t('drv.ride.pinHint')}
                </Txt>
                {/* Passenger didn't show up, or the PIN got locked: free the driver for the next trip. */}
                <Button label={confirmCancel ? t('drv.ride.cancelConfirm') : t('drv.ride.cancelTrip')} variant="outlineDark" size="md" disabled={busy} onPress={cancelRide} />
              </View>
            ) : null}

            {phase === 'trip' ? (
              <View style={{ marginTop: space[4], gap: space[3] }}>
                <ProgressBar value={tripP} tone="dark" height={8} />
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt v="caption" color={colors.onDarkMuted}>
                    {t('drv.ride.remaining', { km: km(fare.distanceKm * (1 - tripP)) })}
                  </Txt>
                  <Txt v="caption" color={colors.lime} tabular>
                    {t('drv.ride.earning', { amount: cop(fare.driverEarnings) })}
                  </Txt>
                </Row>
                <Button label={tripP >= 0.92 || gps ? t('drv.ride.finish') : t('drv.ride.enRoute')} icon={Flag} disabled={!gps && tripP < 0.92} loading={busy} onPress={complete} />
              </View>
            ) : null}
          </View>
        </Sheet>
      ) : null}

      {/* ── Completed: earnings updated ───────────────────── */}
      {phase === 'complete' ? (
        <Sheet tone="dark" stateKey="complete">
          <ScrollView style={{ maxHeight: 640 }} contentContainerStyle={{ paddingHorizontal: space[5] }} showsVerticalScrollIndicator={false}>
            <Row style={{ gap: 12 }}>
              <Animated.View entering={ZoomIn.springify()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
                <Check size={24} color={colors.midnight} strokeWidth={3} />
              </Animated.View>
              <View style={{ flex: 1 }}>
                <Txt v="overline" color={colors.onDarkMuted}>
                  {t('common.tripCompleted')}
                </Txt>
                <Txt v="h3" color={colors.ivory}>
                  {t('drv.ride.addedToEarnings', { amount: cop(fare.driverEarnings) })}
                </Txt>
              </View>
            </Row>
            {live ? (
              // Live: the passenger paid the driver directly; NÜVA's 12 % came out of the prepaid wallet.
              <Animated.View entering={FadeIn.delay(250)} style={{ marginTop: space[4], padding: 16, borderRadius: radius.lg, backgroundColor: colors.midnight700, gap: 10 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <View style={{ flex: 1 }}>
                    <Txt v="caption" color={colors.onDarkMuted}>
                      {t('drv.ride.collect', { method: paymentLabel(req.payment, t) })}
                    </Txt>
                    <Money value={cop(fare.finalFare - (req.discount ?? 0))} size={32} color={colors.ivory} signColor={colors.lime} />
                  </View>
                  {paid ? <Badge label={t('drv.ride.paymentReceived')} tone="lime" /> : null}
                </Row>
                <Txt v="caption" color={colors.onDarkFaint}>
                  {t('drv.ride.commissionDeducted', { amount: cop(fare.platformCommission) })}
                </Txt>
                {req.discount ? (
                  <Txt v="caption" color={colors.lime}>
                    {t('drv.ride.promoCredited', { amount: cop(req.discount) })}
                  </Txt>
                ) : null}
                {!paid ? (
                  <Button
                    label={t('drv.ride.confirmPayment')}
                    size="md"
                    variant="outlineDark"
                    loading={busy}
                    onPress={async () => {
                      setBusy(true);
                      try {
                        await confirmDirectPayment(liveTripId!);
                        setPaid(true);
                      } catch (e) {
                        toast(e instanceof Error ? e.message : t('drv.ride.confirmError'), 'warning');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                ) : null}
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.delay(250)} style={{ marginTop: space[4], padding: 16, borderRadius: radius.lg, backgroundColor: colors.midnight700, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <View>
                  <Txt v="caption" color={colors.onDarkMuted}>
                    {t('drv.ride.todayNet')}
                  </Txt>
                  <Txt v="small" color={colors.onDarkFaint} tabular style={{ textDecorationLine: 'line-through' }}>
                    {cop(todayBefore)}
                  </Txt>
                </View>
                <Money value={cop(todayBefore + fare.driverEarnings)} size={32} color={colors.ivory} signColor={colors.lime} />
              </Animated.View>
            )}
            <View style={{ marginTop: space[4] }}>
              <FareBreakdownCard fare={fare} config={pricing} audience="driver" tone="dark" compact />
            </View>
            <Txt v="smallStrong" color={colors.ivory} align="center" style={{ marginTop: space[5] }}>
              {t('drv.ride.ratePassenger', { name: req.passenger })}
            </Txt>
            <Row style={{ justifyContent: 'center', gap: 6, marginTop: 10 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Tap key={s} onPress={() => setStars(s)} accessibilityLabel={t('common.starsCount', { n: s })} scaleTo={0.85}>
                  <Star size={34} color={s <= stars ? colors.lime : colors.midnight400} fill={s <= stars ? colors.lime : 'transparent'} strokeWidth={1.6} />
                </Tap>
              ))}
            </Row>
            <Button
              label={t('drv.ride.doneNext')}
              style={{ marginTop: space[5] }}
              onPress={() => {
                toast(live ? t('drv.ride.tripLogged') : t('drv.ride.earningsUpdated', { amount: cop(todayBefore + fare.driverEarnings) }));
                // navigate (not replace) returns to the dashboard already mounted below,
                // instead of stacking a second copy with duplicate realtime listeners.
                router.navigate('/driver/home');
              }}
            />
            <Button label={t('drv.ride.seeEarnings')} variant="outlineDark" size="md" style={{ marginTop: 10 }} onPress={() => router.navigate('/driver/earnings')} />
          </ScrollView>
        </Sheet>
      ) : null}

      {onTrip && session ? (
        <TripChat
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
          tripId={liveTripId!}
          myId={session.user.id}
          otherName={req.passenger}
          messages={chat.messages}
          tone="dark"
        />
      ) : null}
    </View>
  );
}
