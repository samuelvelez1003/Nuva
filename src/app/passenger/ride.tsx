import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, Share, Switch, TextInput, View } from 'react-native';
import { TripChat, useTripChat } from '../../components/trip/TripChat';
import { CardPayment, DirectPayment, useCardPayments } from '../../components/trip/CardPayment';
import { useAuth } from '../../store/Auth';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Bike,
  CalendarCheck,
  CalendarClock,
  Car,
  Check,
  ChevronDown,
  Landmark,
  MapPin,
  MessageCircle,
  Phone,
  RotateCw,
  Search,
  Flag,
  Share2,
  Ticket,
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
import { Avatar, Badge, Chip, Divider, LiveDot, ProgressBar, Row, Skeleton, Stars } from '../../components/ui/primitives';
import { Sheet } from '../../components/ui/Sheet';
import { useStatusTone, useToast } from '../../components/ui/Screen';
import { Money, Txt } from '../../components/ui/Txt';
import { CURRENT_LOCATION, Place, PLACES } from '../../data/places';
import { useLocation } from '../../lib/location';
import { useSavedPlaces } from '../../lib/savedPlaces';
import { PAYMENT_METHODS, paymentDetail, paymentLabel, paymentMethodsFor, PaymentId, RATING_TAGS_PASSENGER } from '../../data/mock';
import { TFunction, TKey, useT } from '../../i18n';
import { useNuvaSettings } from '../../lib/settings';
import { useCountry } from '../../lib/country';
import { safePointsNear } from '../../data/pinnedPlaces';
import { daySlots, earliestSlot, isNightBogota, scheduleDays, dayName, whenLabel } from '../../lib/schedule';
import { CUSTOMER_URL } from '../../lib/site';
import { calculateFare, CategoryId, CATEGORY_ORDER, FareBreakdown } from '../../lib/fare';
import { addMinutes, clock, cop, km, minutes, num } from '../../lib/format';
import { LatLng, offset, pointAlong, project } from '../../lib/geo';
import { reverseGeocode } from '../../lib/geocode';
import { addRecentPlace } from '../../lib/recentPlaces';
import { OFF_ROUTE_M, snapToRoute, useGlide } from '../../lib/carMotion';
import { fetchStreetRoute, ROUTE_REFRESH_MS, RouteResult } from '../../lib/routing';
import { useProgress, useTick } from '../../lib/hooks';
import { checkPromo, Counterpart, fetchCounterpart, fetchMyPin, fetchTrip, shareTrip as createShareLink, TripRow, watchPresence, watchTrip } from '../../lib/liveTrips';
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
    tone: colors.sage,
    phoneMasked: '',
    phone: c.phone ?? null,
  };
}
const PAY_ICON = { cash: Banknote, wallet: Wallet, bank: Landmark, card: CreditCard };

/** Licence plate: yellow, black, framed; the bottom line names the country. */
function Plate({ plate, region }: { plate: string; region: string }) {
  return (
    <View style={{ backgroundColor: '#F6CB2F', borderRadius: 6, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, paddingTop: 2, paddingBottom: 1, alignItems: 'center' }}>
      <Txt style={{ fontFamily: fonts.extrabold, fontSize: 17, letterSpacing: 1.2, lineHeight: 20 }} color={colors.ink}>
        {plate}
      </Txt>
      <Txt style={{ fontFamily: fonts.bold, fontSize: 7, letterSpacing: 1.5, lineHeight: 9 }} color={colors.ink}>
        {region}
      </Txt>
    </View>
  );
}

/** "$9.300 a Nequi 300 123 4567", "$9.300 en efectivo", … */
function payInstruction(t: TFunction, method: PaymentId, amount: string, account?: string | null) {
  const label = paymentLabel(method, t);
  if (method === 'cash') return t('pax.ride.cashAmount', { amount });
  const acct = account ? (/^\d{10}$/.test(account) ? account.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') : account) : null;
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

type Mode = 'categories' | 'breakdown' | 'payment' | 'pickup' | 'promo' | 'pin' | 'schedule' | 'scheduled';

/** "Identidad verificada hoy" when the driver's selfie check is from today, otherwise without the day. */
const identityLabel = (at: string, t: TFunction) => {
  const d = new Date(at);
  return d.toDateString() === new Date().toDateString() ? t('pax.safe.identityToday') : t('pax.safe.identity');
};

/** A previous late cancellation is collected in the next trip: shown in the quote. */
const withPending = (f: FareBreakdown, pending: number): FareBreakdown =>
  pending > 0 ? { ...f, pendingFee: pending, finalFare: f.finalFare + pending, platformCommission: f.platformCommission + pending } : f;

export default function RideFlow() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const t = useT();
  const app = useApp();
  const { ride, pricing, payment, setPayment } = app;
  const { profile, session, live: backendLive } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const { settings: walletRules } = useNuvaSettings();
  const [feeWarned, setFeeWarned] = useState(false);
  // Chat with the driver: only once a driver accepted, until the trip ends.
  const chatTripId = ride?.tripId && ride.driver && (ride.phase === 'assigned' || ride.phase === 'arriving' || ride.phase === 'in-trip') ? ride.tripId : undefined;
  const chat = useTripChat(chatTripId, session?.user.id, chatOpen);
  const { code: countryCode, country } = useCountry();
  const [mode, setMode] = useState<Mode>('categories');
  // Pickup chosen by dragging the map (point under the pin + its street address).
  const [pin, setPin] = useState<{ point: LatLng | null; address: string | null; area: string; locating: boolean }>({ point: null, address: null, area: '', locating: false });
  // Which point the pin moves: where we pick the passenger up, or where we go.
  const [pinTarget, setPinTarget] = useState<'pickup' | 'destination'>('pickup');
  const pinSeq = useRef(0);
  const startPinRef = useRef<(target: 'pickup' | 'destination') => void>(() => {});
  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState<TKey[]>(['pax.tag.punctual']);
  const [tip, setTip] = useState(0);
  const [note, setNote] = useState('');
  const [requesting, setRequesting] = useState(false);
  useStatusTone('dark');
  const location = useLocation();
  const savedPlaces = useSavedPlaces();

  // Card trips only when the server has Wompi on; otherwise the method isn't offered.
  const cardsOn = useCardPayments(backendLive);
  useEffect(() => {
    if (cardsOn === false && payment === 'card') setPayment('cash');
  }, [cardsOn, payment, setPayment]);

  // Scheduled trip: the pickup time chosen ("Programar"), and the picker's draft.
  const [scheduleAt, setScheduleAt] = useState<Date | null>(null);
  const [draftDay, setDraftDay] = useState<Date | null>(null);
  const [draftSlot, setDraftSlot] = useState<Date | null>(null);
  const [scheduledDone, setScheduledDone] = useState<{ when: Date; amount: number; code: string } | null>(null);
  const isWoman = profile?.gender === 'f';

  // Public live link of this trip (one token per trip, reused while it lasts).
  const [shareLink, setShareLink] = useState<{ tripId: string; url: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  // A card trip whose card failed and is now paid to the driver directly.
  const [switchedFromCard, setSwitchedFromCard] = useState(false);

  // From the search screen's "Elegir en el mapa": open straight in destination-pin mode.
  const { pin: pinParam, k: pinKey } = useLocalSearchParams<{ pin?: string; k?: string }>();
  const pinOpened = useRef<string | null>(null);
  useEffect(() => {
    if ((pinParam !== 'destination' && pinParam !== 'pickup') || !ride || ride.phase !== 'quote') return;
    const key = `${pinParam}-${pinKey ?? ''}-${ride.id}`;
    if (pinOpened.current === key) return;
    pinOpened.current = key;
    startPinRef.current(pinParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinParam, pinKey, ride?.id]);

  // Deep-link / screen index entry: start a sample quote.
  useEffect(() => {
    if (!ride) app.startQuote(PLACES.find((p) => p.id === country.web.heroDest) ?? PLACES[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phase = ride?.phase ?? 'quote';
  const quotes = useMemo(
    () =>
      ride
        ? CATEGORY_ORDER.filter((c) => pricing.categories[c].enabled).map((c) =>
            // A scheduled trip is priced for its pickup time (night surcharge), like the server does.
            withPending(calculateFare(ride, pricing, c, { pickup: ride.pickup, destination: ride.destination, at: scheduleAt ?? new Date(), country: countryCode }), profile?.pending_fee ?? 0),
          )
        : [],
    [ride, pricing, countryCode, profile?.pending_fee, scheduleAt],
  );
  const selected = quotes.find((q) => q.category === ride?.category) ?? quotes[0];
  const fare = ride?.fare ?? selected;

  // Promo code: checked by the server against the selected fare (and again on request).
  const [promoText, setPromoText] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const applyPromo = async (code: string) => {
    if (!selected || !code.trim()) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const r = await checkPromo(code.trim(), selected.finalFare);
      if (!r.ok) setPromoError(r.error ?? t('pax.promo.invalid'));
      else {
        app.patchRide({ promo: { code: r.code!, title: r.title ?? r.code!, discount: r.discount ?? 0 } });
        setMode('categories');
        toast(t('pax.promo.applied', { amount: cop(r.discount ?? 0) }));
      }
    } catch {
      setPromoError(t('pax.promo.checkError'));
    } finally {
      setPromoBusy(false);
    }
  };
  // Discount follows the chosen category's fare (the server computes it again on request).
  useEffect(() => {
    const code = ride?.promo?.code;
    if (!code || ride?.phase !== 'quote' || !selected) return;
    checkPromo(code, selected.finalFare)
      .then((r) => app.patchRide({ promo: r.ok ? { code, title: r.title ?? code, discount: r.discount ?? 0 } : undefined }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.finalFare]);
  /** What the passenger actually pays the driver: server discount once requested, preview before. */
  const discount = ride?.tripId ? ride.discount ?? 0 : ride?.promo?.discount ?? 0;
  // A category paused by the admin while quoting: switch to the one actually shown, so the
  // button, the price and what's sent to the server always match.
  useEffect(() => {
    if (ride?.phase === 'quote' && selected && selected.category !== ride.category) app.setCategory(selected.category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.phase, ride?.category, selected?.category]);

  // Live trips follow the server; demo trips run on timers.
  const live = !!ride?.tripId;

  // Driver approach on real streets with live traffic (Mapbox). Live: from the driver's
  // real position, refreshed every ~75 s and re-routed when they leave it. Demo: from a
  // point about 1 km away. Until it answers only the markers show (no straight line).
  const approaching = ride?.phase === 'assigned' || ride?.phase === 'arriving';
  const demoStart = useMemo(() => (ride ? offset(ride.pickup, 820, -640) : CURRENT_LOCATION), [ride?.pickup]);
  const [approachR, setApproachR] = useState<{ rideId: string; r: RouteResult | null } | null>(null);
  const lastRoute = useRef(0);
  const routeTo = useCallback(
    (from: LatLng, fresh = false) => {
      if (!ride) return;
      const rideId = ride.id;
      lastRoute.current = Date.now();
      fetchStreetRoute(from, ride.pickup, { fresh }).then((r) =>
        // A failed refresh keeps the last street route; only a first failure shows the error.
        setApproachR((cur) => (r || !cur || cur.rideId !== rideId || !cur.r ? { rideId, r } : cur)),
      );
    },
    [ride],
  );
  const driverPosRef = useRef(ride?.driverPos);
  useEffect(() => {
    driverPosRef.current = ride?.driverPos;
  });
  const hasDriverPos = !!ride?.driverPos;
  useEffect(() => {
    if (!ride || !approaching) return;
    if (approachR?.rideId === ride.id) return;
    if (live && !ride.driverPos) return; // wait for the first real position
    routeTo(live && ride.driverPos ? ride.driverPos : demoStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.id, approaching, live, hasDriverPos]);
  // Live approach: a fresh route with traffic every ~75 s from where the driver is.
  useEffect(() => {
    if (!live || !approaching) return;
    const id = setInterval(() => {
      if (driverPosRef.current) routeTo(driverPosRef.current, true);
    }, ROUTE_REFRESH_MS);
    return () => clearInterval(id);
  }, [live, approaching, routeTo]);
  const approachEntry = approachR && ride && approachR.rideId === ride.id ? approachR : null;
  const approachRoute = approachEntry?.r ?? null;
  const approachStatus: 'loading' | 'ready' | 'failed' | undefined = !approaching || (live && !ride?.driverPos) ? undefined : approachRoute ? 'ready' : approachEntry ? 'failed' : 'loading';
  const approachOrigin = live && ride?.driverPos ? ride.driverPos : demoStart;
  const approach = useMemo(
    // Two-point placeholder while the street route loads: never drawn, only used to frame the map.
    () => approachRoute?.points ?? (ride ? [project(approachOrigin), project(ride.pickup)] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [approachRoute, ride?.pickup, approachOrigin.lat, approachOrigin.lng],
  );
  // Minutes with traffic from the street route (the countdown follows the car along it);
  // the category's typical pickup time until it answers — never a made-up route.
  const approachEta = approachRoute ? approachRoute.durationMin : ride ? pricing.categories[ride.category].etaMinutes : 1;
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
          ...(cp
            ? {
                driver: driverFromCounterpart(row.driver_id ?? 'driver', cp, t),
                driverNequi: cp.payAccount ?? cp.nequi ?? null,
                driverAvatar: cp.avatar ?? null,
                driverIdentityAt: cp.identityCheckedAt ?? null,
                driverWomenVerified: !!cp.womenVerified,
              }
            : {}),
          phase: row.status === 'accepted' ? 'assigned' : row.status === 'arriving' ? 'arriving' : 'in-trip',
          // The server's fare: it can grow when the trip starts (paid waiting at the pickup).
          ...(row.fare ? { fare: row.fare } : {}),
          // The server's start time, so progress doesn't reset when the screen reopens.
          ...(row.status === 'in_progress' ? { startedAt: row.started_at ? new Date(row.started_at) : new Date() } : {}),
        });
      } else if (row.status === 'completed') {
        const cp = await fetchCounterpart(row.id).catch(() => null);
        if (cp) app.patchRide({ driverNequi: cp.payAccount ?? cp.nequi ?? null });
        // The server's payment: a card trip switched to direct, or paid through Wompi (the tip is then final).
        const paid = row.payment_status === 'pagado';
        app.patchRide({ payment: (row.payment as PaymentId) ?? 'cash', paymentChannel: row.payment_channel, paid });
        if (paid && row.payment === 'card' && row.tip != null) setTip(row.tip);
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
    setSwitchedFromCard(false);
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
  // A scheduled trip is offered 15 min before its pickup time: it waits until 10 min after it.
  useEffect(() => {
    if (!live || phase !== 'matching' || !ride?.requestedAt) return;
    const deadline = ride.scheduledFor ? ride.scheduledFor.getTime() + 10 * 60_000 : ride.requestedAt.getTime() + 10 * 60_000;
    const left = deadline - Date.now();
    const id = setTimeout(() => {
      app
        .cancelRide({ keepQuote: true })
        .then(() => toast(t('pax.ride.noDriversFound'), 'warning'))
        .catch(() => {});
    }, Math.max(0, left));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, phase, ride?.requestedAt, ride?.scheduledFor]);

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
    if (Date.now() - lastRoute.current > 15_000) routeTo(ride.driverPos, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, approaching, ride?.driverPos?.lat, ride?.driverPos?.lng]);

  // In the trip (live): ETA with traffic refreshed every ~75 s from where the car is,
  // and a new street route when the driver leaves the suggested one.
  const [tripEta, setTripEta] = useState<{ tripId: string; min: number; at: number } | null>(null);
  const lastTripRoute = useRef(0);
  const inTripLive = live && ride?.phase === 'in-trip';
  const refreshTrip = useCallback(
    (reroute: boolean) => {
      const pos = driverPosRef.current;
      if (!ride?.tripId || !pos) return;
      const tripId = ride.tripId;
      lastTripRoute.current = Date.now();
      fetchStreetRoute(pos, ride.destination, { fresh: true }).then((r) => {
        if (!r) return; // keeps the last route and ETA; the next refresh tries again
        setTripEta({ tripId, min: r.durationMin, at: r.at });
        if (reroute) app.patchRide({ route: r.points, steps: r.steps, routeSource: 'street', routeStatus: 'ready' });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ride?.tripId, ride?.destination.lat, ride?.destination.lng],
  );
  useEffect(() => {
    if (!inTripLive || !hasDriverPos) return;
    refreshTrip(false);
    const id = setInterval(() => refreshTrip(false), ROUTE_REFRESH_MS);
    return () => clearInterval(id);
  }, [inTripLive, hasDriverPos, refreshTrip]);
  useEffect(() => {
    if (!inTripLive || !ride?.driverPos || !snap || onRoute) return;
    if (Date.now() - lastTripRoute.current > 15_000) refreshTrip(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inTripLive, ride?.driverPos?.lat, ride?.driverPos?.lng]);

  // Street route failed (every service): say so on the map and try again by itself.
  useEffect(() => {
    if (ride?.routeStatus !== 'failed') return;
    const id = setTimeout(() => app.retryRoute(), 12_000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.routeStatus, ride?.id]);
  const retryApproach = () => routeTo(live && driverPosRef.current ? driverPosRef.current : demoStart, true);
  useEffect(() => {
    if (approachStatus !== 'failed') return;
    const id = setTimeout(retryApproach, 12_000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approachStatus, approachR]);
  const liveCar = livePos ? (onRoute && snap ? { ...snap.pt, heading: snap.heading } : livePos) : null;
  const glidingCar = useGlide(live ? liveCar : null);

  const liveTripTime = ride?.startedAt ? Math.min(0.98, (Date.now() - ride.startedAt.getTime()) / (ride.durationMin * 60_000)) : 0;
  const tripP = live ? (ride?.phase === 'in-trip' && onRoute && snap ? snap.fraction : liveTripTime) : simTripP;
  const approachP = live ? (approaching && onRoute && snap ? snap.fraction : 0) : simApproachP;

  // Arrival time is set when the trip starts and moved by each traffic refresh.
  const [arrival, setArrival] = useState<Date>(new Date());
  useEffect(() => {
    if (phase === 'in-trip' && ride) setArrival(addMinutes(new Date(), ride.durationMin));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  const freshEta = tripEta && ride?.tripId === tripEta.tripId && phase === 'in-trip' ? tripEta : null;
  const arrivalAt = freshEta ? new Date(freshEta.at + freshEta.min * 60_000) : arrival;
  // Clock for the live countdown between traffic refreshes.
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    if (!inTripLive) return;
    const id = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [inTripLive]);

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
  const pinMode = phase === 'quote' && mode === 'pin';
  const sheetH = pinMode ? 300 : phase === 'quote' ? 470 : phase === 'completed' ? 600 : phase === 'rated' ? 380 : 330;
  const focus =
    pinMode
      ? [offset(pinTarget === 'destination' ? ride.destination : ride.pickup, -120, -120), offset(pinTarget === 'destination' ? ride.destination : ride.pickup, 120, 120)]
      : phase === 'quote' && mode === 'pickup'
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

  // Live: minutes from the latest traffic refresh, counted down since; demo: along the route.
  const remainingMin = freshEta
    ? Math.max(1, Math.round(freshEta.min - Math.max(0, nowMs - freshEta.at) / 60_000))
    : Math.max(1, Math.round(ride.durationMin * (1 - tripP)));
  const routeReady = ride.routeSource === 'street';
  const quoteRouteFailed = ride.routeStatus === 'failed';
  // Minutes left on the street route (with traffic), from where the car is on it.
  // Live without a driver position yet: the category's typical pickup time, not a made-up route.
  const approachLeft =
    live && !ride.driverPos ? pricing.categories[ride.category].etaMinutes : Math.max(1, Math.round(approachEta * (1 - approachP)));

  // navigate (not replace) returns to the tabs already mounted below.
  const exit = () => {
    app.clearRide();
    router.navigate('/passenger/home');
  };
  /**
   * Shares the trip through the phone's share sheet: the public live link (live trips; the
   * page follows the car, no account needed) plus driver, plate and destination once known.
   * On a computer without a share sheet the text is copied instead.
   */
  const shareTrip = async () => {
    let url: string | null = null;
    if (live && ride.tripId) {
      if (shareLink?.tripId === ride.tripId) url = shareLink.url;
      else {
        setSharing(true);
        try {
          const token = await createShareLink(ride.tripId);
          url = `${CUSTOMER_URL}/viaje?t=${encodeURIComponent(token)}`;
          setShareLink({ tripId: ride.tripId, url });
        } catch {
          // Without the link the driver details are still worth sending.
        } finally {
          setSharing(false);
        }
      }
    }
    const details = ride.driver
      ? t('pax.ride.shareMessage', {
          driver: ride.driver.name,
          plate: ride.driver.plate,
          car: ride.driver.car,
          place: ride.destination.name,
          code: ride.tripCode ?? ride.id,
        })
      : null;
    const message = [url ? t('pax.share.message', { url }) : null, details].filter(Boolean).join('\n');
    if (!message) return toast(t('pax.ride.shareError'), 'warning');
    try {
      await Share.share({ message });
    } catch {
      const clip = (globalThis as { navigator?: { clipboard?: { writeText: (s: string) => Promise<void> } } }).navigator?.clipboard;
      if (clip) await clip.writeText(message).then(() => toast(t('pax.share.copied'))).catch(() => toast(t('pax.ride.shareError'), 'warning'));
      else toast(t('pax.ride.shareError'), 'warning');
    }
  };

  /** "Paga directo a Carlos: $9.300 a Nequi 300 123 4567". */
  const directBox = (amount: string) => (
    <View style={{ marginTop: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.midnight, gap: 4 }}>
      <Txt v="caption" color={colors.onDarkMuted}>
        {t('pax.ride.payDirect', { name: ride.driver?.name.split(' ')[0] ?? t('pax.ride.yourDriver') })}
      </Txt>
      <Txt v="title" color={colors.ivory}>
        {payInstruction(t, ride.payment, amount, ride.driverNequi)}
      </Txt>
      <Txt v="caption" color={colors.onDarkFaint}>
        {t('pax.ride.driverConfirms')}
      </Txt>
    </View>
  );

  /** A card trip now paid to the driver directly (the server agreed): show where to pay them. */
  const onSwitchedToDirect = (method: DirectPayment) => {
    setSwitchedFromCard(true);
    app.patchRide({ payment: method, paymentChannel: 'direct', paid: false });
    const tripId = ride.tripId;
    if (tripId) {
      fetchCounterpart(tripId)
        .then((cp) => cp && app.patchRide({ driverNequi: cp.payAccount ?? cp.nequi ?? null }))
        .catch(() => {});
    }
  };

  // ── Scheduling: day + 15-minute slot, 30 min to 7 days ahead ──
  const openSchedule = () => {
    const days = scheduleDays();
    const day = scheduleAt && days.some((d) => d.toDateString() === scheduleAt.toDateString()) ? scheduleAt : days[0];
    setDraftDay(day);
    setDraftSlot(scheduleAt && scheduleAt >= earliestSlot() ? scheduleAt : null);
    setMode('schedule');
  };

  const request = async () => {
    // Without GPS the "current location" is only the city centre: ask for location
    // or a chosen pickup first, so the driver isn't sent to the wrong place.
    if (backendLive && ride.pickup.id === 'current' && location.status !== 'granted') {
      await location.request();
      toast(t('pax.ride.needPickup'), 'info');
      setMode('pickup');
      return;
    }
    // A time chosen a while ago may now be too close: pick again.
    if (scheduleAt && scheduleAt.getTime() < Date.now() + 29 * 60_000) {
      toast(t('pax.sched.tooSoon'), 'warning');
      return openSchedule();
    }
    setRequesting(true);
    try {
      const at = scheduleAt;
      const row = await app.requestRide({ scheduledFor: at });
      if (at && row) {
        // Saved for later: no search now. Confirm, then back home (listed there until it's released).
        setScheduledDone({ when: at, amount: row.final_fare - (row.discount ?? 0), code: row.code });
        setScheduleAt(null);
        setMode('scheduled');
        toast(t('pax.sched.done', { when: whenLabel(at, t) }));
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : t('pax.ride.requestError'), 'warning');
    } finally {
      setRequesting(false);
    }
  };

  // The card is only offered while the server has card payments on.
  const payMethods = paymentMethodsFor(countryCode).filter((m) => m.id !== 'card' || cardsOn);

  // Safe meeting points near the passenger (more prominent at night, Bogotá time).
  // Around the phone's GPS position; without GPS, around the pickup chosen so far.
  const night = isNightBogota();
  const safeAnchor = location.status === 'granted' ? location.here : ride.pickup;
  const safeNear = safePointsNear(safeAnchor.lat, safeAnchor.lng);
  const safePoints = safeNear.length ? (
    <View style={{ marginBottom: space[3], padding: night ? 12 : 0, borderRadius: radius.lg, backgroundColor: night ? colors.midnight : 'transparent', gap: 8 }}>
      <Row style={{ gap: 8 }}>
        <ShieldCheck size={16} color={night ? colors.limeOnDark : colors.ink} />
        <Txt v="smallStrong" color={night ? colors.ivory : colors.ink} style={{ flex: 1 }}>
          {t('pax.safe.title')}
        </Txt>
      </Row>
      {night ? (
        <Txt v="caption" color={colors.onDarkMuted}>
          {t('pax.safe.night')}
        </Txt>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {safeNear.map((p) => (
          <Chip
            key={p.id}
            icon={ShieldCheck}
            tone={night ? 'dark' : 'light'}
            label={`${p.name} · ${km(p.distanceKm)}`}
            active={ride.pickup.id === p.id}
            onPress={() => {
              const place: Place = { id: p.id, kind: p.kind, name: p.name, address: p.address, area: p.area, lat: p.lat, lng: p.lng };
              app.setPickup(place);
              addRecentPlace(place);
            }}
          />
        ))}
      </ScrollView>
    </View>
  ) : null;
  // ── Pickup pin: the passenger drags the map under a fixed pin to the exact door ──
  const startPin = (target: 'pickup' | 'destination' = 'pickup') => {
    const from = target === 'destination' ? ride.destination : ride.pickup;
    setPinTarget(target);
    setPin({ point: { lat: from.lat, lng: from.lng }, address: from.address || from.name || null, area: from.area || '', locating: false });
    setMode('pin');
  };
  startPinRef.current = startPin;
  const onPinMove = (c: LatLng) => {
    setPin({ point: c, address: null, area: '', locating: true });
    const seq = ++pinSeq.current;
    reverseGeocode(c).then((r) => {
      if (seq === pinSeq.current) setPin({ point: c, address: r?.address ?? null, area: r?.area ?? '', locating: false });
    });
  };
  const confirmPin = () => {
    const from = pinTarget === 'destination' ? ride.destination : ride.pickup;
    const c = pin.point ?? { lat: from.lat, lng: from.lng };
    const place: Place = {
      id: `pin-${c.lat.toFixed(5)},${c.lng.toFixed(5)}`,
      kind: 'poi',
      name: pin.address || t('pax.pin.point'),
      address: pin.address || t('pax.pin.point'),
      area: pin.area,
      lat: c.lat,
      lng: c.lng,
    };
    // Destination: a new quote from the same pickup (route, distance and prices recalculated).
    if (pinTarget === 'destination') app.startQuote(place, ride.pickup);
    else app.setPickup(place);
    addRecentPlace(place);
    setMode('categories');
  };

  // The driver is already at the pickup: cancelling now has a fee — warn first, then a second tap.
  /** Cancels on the server first; the screen only changes once the server agreed. */
  const cancelActive = async (next: () => void, keepQuote = false) => {
    if (live && phase === 'arriving' && walletRules.noShowFee > 0 && !feeWarned) {
      setFeeWarned(true);
      setTimeout(() => setFeeWarned(false), 6000);
      return toast(t('pax.ride.cancelFeeWarn', { amount: cop(walletRules.noShowFee) }), 'warning');
    }
    try {
      await app.cancelRide({ keepQuote });
      next();
    } catch (e) {
      toast(e instanceof Error ? e.message : t('pax.ride.cancelError'), 'warning');
    }
  };

  const shownRoute = pinMode ? undefined : phase === 'assigned' || phase === 'arriving' ? approach : phase === 'completed' || phase === 'rated' ? undefined : ride.route;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ivory200 }}>
      <CityMap
        focus={focus}
        minSpan={phase === 'matching' ? 140 : 90}
        insets={{ top: insets.top + 124, bottom: sheetH + 24, left: 48, right: 48 }}
        route={shownRoute}
        progress={phase === 'assigned' ? approachP : phase === 'in-trip' ? tripP : 0}
        onPinMove={pinMode ? onPinMove : undefined}
        routeStatus={pinMode ? undefined : approaching ? approachStatus : phase === 'quote' || phase === 'in-trip' ? ride.routeStatus : undefined}
        onRetryRoute={approaching ? retryApproach : app.retryRoute}
        hotspots={phase === 'matching' ? [{ center: ride.pickup, radius: 900, intensity: 0.4 + 0.6 * Math.abs(Math.sin(matchP * Math.PI * 3)) }] : undefined}
        renderMarkers={(toScreen) => (
          <>
            {(phase === 'quote' && !pinMode) || phase === 'matching' ? (
              <PlacePin
                pos={toScreen(ride.pickup)}
                kind="pickup"
                title={mode === 'pickup' ? ride.pickup.name : t('common.pickup')}
                sub={phase === 'quote' && mode !== 'pickup' ? t('common.minutesShort', { n: pricing.categories[ride.category].etaMinutes }) : undefined}
                route={shownRoute?.map(toScreen)}
              />
            ) : null}
            {phase === 'assigned' || phase === 'arriving' ? (
              <>
                <UserDot pos={toScreen(ride.pickup)} />
                {carOnApproach ? <CarMarker pos={toScreen(carOnApproach)} heading={carOnApproach.heading} /> : null}
              </>
            ) : null}
            {phase !== 'assigned' && phase !== 'arriving' && phase !== 'matching' && !pinMode ? (
              <PlacePin
                pos={toScreen(ride.destination)}
                kind="dropoff"
                title={phase === 'quote' && mode === 'pickup' ? undefined : ride.destination.name}
                sub={phase === 'in-trip' ? clock(arrivalAt) : phase === 'quote' && routeReady ? minutes(ride.durationMin) : undefined}
                route={shownRoute?.map(toScreen)}
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
            if (phase === 'quote' && mode === 'scheduled') return exit();
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
              {ride.destination.name}
              {routeReady ? ` · ${km(ride.distanceKm)}` : ''}
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
                  {/* Distance, time and prices only from the street route with traffic. */}
                  <Txt v="caption" color={quoteRouteFailed ? colors.limeInk : colors.inkMuted} accessibilityLiveRegion="polite">
                    {routeReady
                      ? `${km(ride.distanceKm)} · ${minutes(ride.durationMin)} · ${t('pax.ride.arriveAt', { time: clock(addMinutes(new Date(), ride.durationMin + pricing.categories[ride.category].etaMinutes)) })}`
                      : quoteRouteFailed
                        ? t('route.failed')
                        : t('route.loading')}
                  </Txt>
                </View>
                <Row style={{ gap: 6 }}>
                  <Tap onPress={() => setMode('pickup')} accessibilityLabel={t('pax.ride.adjustPickup')}>
                    <Row style={{ gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.ivory100 }}>
                      <MapPin size={14} color={colors.ink} />
                      <Txt v="caption">{t('common.pickup')}</Txt>
                    </Row>
                  </Tap>
                  <Tap onPress={() => startPin('destination')} accessibilityLabel={t('pax.pin.adjustDestination')}>
                    <Row style={{ gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.ivory100 }}>
                      <Flag size={14} color={colors.ink} />
                      <Txt v="caption">{t('common.destination')}</Txt>
                    </Row>
                  </Tap>
                </Row>
              </Row>
              <ScrollView style={{ maxHeight: isWoman && backendLive ? 196 : 248 }} contentContainerStyle={{ paddingHorizontal: space[3] }} showsVerticalScrollIndicator={false}>
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
                          <Icon size={22} color={active ? colors.limeOnDark : colors.ink} strokeWidth={2.1} />
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
                          {routeReady ? (
                            <Txt v="title" tabular>
                              {cop(q.finalFare)}
                            </Txt>
                          ) : (
                            <Skeleton w={64} h={18} r={6} />
                          )}
                          {routeReady && q.minimumApplied ? (
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
                {/* NÜVA Mujeres: only for passengers whose profile says they're women (the server checks it). */}
                {isWoman && backendLive ? (
                  <Row style={{ gap: 12 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: ride.womenOnly ? colors.midnight : colors.ivory100, alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={17} color={ride.womenOnly ? colors.limeOnDark : colors.ink} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt v="smallStrong">{t('pax.women.toggle')}</Txt>
                      <Txt v="caption" color={colors.inkMuted} numberOfLines={2}>
                        {ride.womenOnly ? t('pax.women.slower') : t('pax.women.toggleSub')}
                      </Txt>
                    </View>
                    <Switch
                      value={!!ride.womenOnly}
                      onValueChange={(v) => app.patchRide({ womenOnly: v })}
                      accessibilityLabel={t('pax.women.toggle')}
                      trackColor={{ false: colors.ivory300, true: colors.midnight }}
                      thumbColor={ride.womenOnly ? colors.coral : colors.white}
                    />
                  </Row>
                ) : null}
                {/* Wraps on narrow phones: payment on one line, code + breakdown on the next. */}
                <Row style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <PaymentPill id={payment} onPress={() => setMode('payment')} />
                  {/* Scheduling needs the server (the trip is kept and offered to drivers later). */}
                  {backendLive ? (
                    <Tap onPress={openSchedule} hitSlop={6} accessibilityLabel={t('pax.sched.title')}>
                      <Row style={{ gap: 6, height: 40, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: scheduleAt ? colors.midnight : colors.ivory100 }}>
                        <CalendarClock size={15} color={scheduleAt ? colors.limeOnDark : colors.ink} />
                        <Txt v="smallStrong" color={scheduleAt ? colors.ivory : colors.ink}>
                          {scheduleAt ? whenLabel(scheduleAt, t) : t('pax.sched.short')}
                        </Txt>
                      </Row>
                    </Tap>
                  ) : null}
                  {backendLive ? (
                    <Tap onPress={() => setMode('promo')} hitSlop={6} accessibilityLabel={t('pax.promo.title')}>
                      <Row style={{ gap: 6, height: 40, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: ride.promo ? colors.lime : colors.ivory100 }}>
                        <Ticket size={15} color={ride.promo ? colors.onLime : colors.ink} />
                        <Txt v="smallStrong" color={ride.promo ? colors.onLime : colors.ink}>{ride.promo ? `${ride.promo.code} · −${cop(ride.promo.discount)}` : t('pax.promo.short')}</Txt>
                      </Row>
                    </Tap>
                  ) : null}
                  <Tap onPress={() => setMode('breakdown')} hitSlop={8}>
                    <Txt v="smallStrong" style={{ textDecorationLine: 'underline' }}>
                      {t('pax.ride.seeBreakdown')}
                    </Txt>
                  </Tap>
                </Row>
                {/* No request until the street route with traffic is in: what's sent is what's priced. */}
                {routeReady ? (
                  <Button
                    label={
                      scheduleAt
                        ? t('pax.sched.request', { category: pricing.categories[ride.category].name })
                        : t('pax.ride.request', { category: pricing.categories[ride.category].name })
                    }
                    loading={requesting}
                    onPress={request}
                    trailing={
                      <Txt v="title" tabular color={colors.onLime}>
                        {cop(selected.finalFare - discount)}
                      </Txt>
                    }
                  />
                ) : quoteRouteFailed ? (
                  <Button label={t('route.retry')} icon={RotateCw} onPress={app.retryRoute} accessibilityHint={t('route.failed')} />
                ) : (
                  <Button label={t('route.calculating')} disabled accessibilityHint={t('route.pending')} />
                )}
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

          {mode === 'pin' ? (
            <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
              <Txt v="h3">{pinTarget === 'destination' ? t('pax.pin.titleDestination') : t('pax.pin.title')}</Txt>
              <Txt v="caption" color={colors.inkMuted}>
                {t('pax.pin.hint')}
              </Txt>
              <Row style={{ gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.ivory100 }}>
                <MapPin size={18} color={colors.ink} />
                <Txt v="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>
                  {pin.locating ? t('pax.pin.locating') : pin.address || t('pax.pin.point')}
                </Txt>
              </Row>
              <Button label={t('pax.pin.confirm')} variant="dark" disabled={pin.locating} onPress={confirmPin} />
              <Button label={t('common.cancel')} variant="ghost" size="md" onPress={() => setMode(pinTarget === 'destination' ? 'categories' : 'pickup')} />
            </View>
          ) : null}

          {mode === 'promo' ? (
            <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
              <Txt v="h3">{t('pax.promo.title')}</Txt>
              <Txt v="caption" color={colors.inkMuted}>
                {t('pax.promo.hint')}
              </Txt>
              <TextInput
                value={promoText}
                onChangeText={(v) => {
                  setPromoText(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12));
                  setPromoError(null);
                }}
                placeholder={t('pax.promo.placeholder')}
                placeholderTextColor={colors.stone}
                autoCapitalize="characters"
                accessibilityLabel={t('pax.promo.title')}
                onSubmitEditing={() => applyPromo(promoText)}
                style={[
                  { height: 52, borderRadius: radius.pill, paddingHorizontal: 20, backgroundColor: colors.white, borderWidth: 1.5, borderColor: promoError ? colors.danger : colors.lineLight, fontFamily: fonts.extrabold, fontSize: 18, letterSpacing: 2, color: colors.ink },
                  { outlineStyle: 'none' } as object,
                ]}
              />
              {promoError ? (
                <Txt v="small" color={colors.dangerInk}>
                  {promoError}
                </Txt>
              ) : null}
              <Button label={t('pax.promo.apply')} variant="dark" loading={promoBusy} disabled={promoText.length < 4} onPress={() => applyPromo(promoText)} />
              {ride.promo ? (
                <Button
                  label={t('pax.promo.remove', { code: ride.promo.code })}
                  variant="outline"
                  size="md"
                  onPress={() => {
                    app.patchRide({ promo: undefined });
                    setMode('categories');
                  }}
                />
              ) : (
                <Button label={t('common.cancel')} variant="ghost" size="md" onPress={() => setMode('categories')} />
              )}
            </View>
          ) : null}

          {mode === 'payment' ? (
            <View style={{ paddingHorizontal: space[5] }}>
              <Txt v="h3" style={{ marginBottom: space[3] }}>
                {t('pax.ride.howPay')}
              </Txt>
              {payMethods.map((m) => {
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
                        <Icon size={20} color={active ? colors.limeOnDark : colors.ink} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt v="bodyStrong">{paymentLabel(m.id, t)}</Txt>
                        <Txt v="caption" color={colors.inkMuted}>
                          {paymentDetail(m.id, t)}
                        </Txt>
                      </View>
                      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: active ? colors.midnight : colors.ivory400, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.midnight : 'transparent' }}>
                        {active ? <Check size={14} color={colors.ivory} strokeWidth={3} /> : null}
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
              {/* At night the safe meeting points come first. */}
              {night ? safePoints : null}
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
              {night ? null : <View style={{ marginTop: space[2] }}>{safePoints}</View>}
              {/* Any address as pickup: works without GPS or saved places. */}
              <Button label={t('pax.pin.adjust')} icon={MapPin} variant="outline" size="md" onPress={() => startPin('pickup')} style={{ marginTop: space[2] }} />
              <Button label={t('pax.ride.searchPickup')} icon={Search} variant="outline" size="md" onPress={() => router.push('/passenger/search?for=pickup')} style={{ marginTop: space[2] }} />
              <Button label={t('pax.ride.confirmPickup')} variant="dark" onPress={() => setMode('categories')} style={{ marginTop: space[3] }} />
            </View>
          ) : null}

          {mode === 'schedule' && draftDay ? (
            <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
              <View>
                <Txt v="h3">{t('pax.sched.title')}</Txt>
                <Txt v="caption" color={colors.inkMuted}>
                  {t('pax.sched.hint')}
                </Txt>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {scheduleDays().map((d) => (
                  <Chip
                    key={d.toDateString()}
                    label={dayName(d, t)}
                    active={d.toDateString() === draftDay.toDateString()}
                    onPress={() => {
                      setDraftDay(d);
                      setDraftSlot(null);
                    }}
                  />
                ))}
              </ScrollView>
              <ScrollView style={{ maxHeight: 176 }} showsVerticalScrollIndicator={false}>
                <Row style={{ flexWrap: 'wrap', gap: 8 }}>
                  {daySlots(draftDay).map((s) => (
                    <Chip
                      key={s.getTime()}
                      label={clock(s)}
                      active={draftSlot?.getTime() === s.getTime()}
                      onPress={() => setDraftSlot(s)}
                      style={{ minWidth: 92, justifyContent: 'center', paddingHorizontal: 8 }}
                    />
                  ))}
                </Row>
              </ScrollView>
              <Button
                label={draftSlot ? t('pax.sched.confirm', { when: whenLabel(draftSlot, t) }) : t('pax.sched.pickTime')}
                variant="dark"
                disabled={!draftSlot}
                onPress={() => {
                  setScheduleAt(draftSlot);
                  setMode('categories');
                }}
              />
              <Button
                label={scheduleAt ? t('pax.sched.asap') : t('common.cancel')}
                variant="ghost"
                size="md"
                onPress={() => {
                  if (scheduleAt) setScheduleAt(null);
                  setMode('categories');
                }}
              />
            </View>
          ) : null}

          {/* Saved for later: nothing to follow now; it shows on the home screen until it's offered to drivers. */}
          {mode === 'scheduled' && scheduledDone ? (
            <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
              <Row style={{ gap: 12 }}>
                <Animated.View entering={ZoomIn.springify()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarCheck size={22} color={colors.midnight} strokeWidth={2.4} />
                </Animated.View>
                <View style={{ flex: 1 }}>
                  <Txt v="overline" color={colors.inkMuted}>
                    {scheduledDone.code}
                  </Txt>
                  <Txt v="h3">{t('pax.sched.doneTitle', { when: whenLabel(scheduledDone.when, t) })}</Txt>
                </View>
              </Row>
              <Row style={{ justifyContent: 'space-between', padding: 14, borderRadius: radius.lg, backgroundColor: colors.ivory100, gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Txt v="caption" color={colors.inkMuted} numberOfLines={1}>
                    {ride.pickup.name} →
                  </Txt>
                  <Txt v="bodyStrong" numberOfLines={1}>
                    {ride.destination.name}
                  </Txt>
                </View>
                <Money value={cop(scheduledDone.amount)} size={24} />
              </Row>
              <Txt v="small" color={colors.inkSoft}>
                {t('pax.sched.doneBody')}
              </Txt>
              <Button label={t('common.backHome')} variant="dark" onPress={exit} />
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
            {ride.scheduledFor || ride.womenOnly ? (
              <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                {ride.scheduledFor ? <Badge label={t('pax.sched.badge', { when: whenLabel(ride.scheduledFor, t) })} tone="dark" /> : null}
                {ride.womenOnly ? <Badge label={t('pax.women.badge')} tone="lime" /> : null}
              </Row>
            ) : null}
            {ride.womenOnly ? (
              <Txt v="caption" color={colors.inkMuted}>
                {t('pax.women.slower')}
              </Txt>
            ) : null}
            <Row style={{ justifyContent: 'space-between', padding: 14, borderRadius: radius.lg, backgroundColor: colors.ivory100 }}>
              <View>
                <Txt v="caption" color={colors.inkMuted}>
                  {t('pax.ride.closedPriceLine', { category: pricing.categories[ride.category].name })}
                </Txt>
                <Txt v="bodyStrong" numberOfLines={1}>
                  {ride.destination.name}
                </Txt>
              </View>
              <Money value={cop(fare.finalFare - discount)} size={24} />
            </Row>
            {/* The live link works from the request on: whoever gets it sees the driver once one accepts. */}
            {live ? <Button label={t('pax.share.live')} icon={Share2} variant="dark" size="md" loading={sharing} onPress={shareTrip} /> : null}
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
                      : t('pax.ride.youArrive', { time: clock(arrivalAt) })}
                </Txt>
              </View>
              {phase !== 'in-trip' ? (
                <View style={{ alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.midnight }}>
                  <Txt v="caption" color={colors.onDarkMuted}>
                    PIN
                  </Txt>
                  <Txt style={{ fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: 2 }} color={colors.limeOnDark} tabular>
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
              <Avatar initials={ride.driver.initials} size={52} bg={ride.driver.tone} image={ride.driverAvatar} />
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
              <Plate plate={ride.driver.plate} region="COLOMBIA" />
            </Row>
            {/* Visible safety: a recent selfie identity check, and NÜVA Mujeres drivers verified by NÜVA. */}
            {ride.driverIdentityAt || ride.driverWomenVerified ? (
              <Row style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {ride.driverIdentityAt ? <Badge label={identityLabel(ride.driverIdentityAt, t)} tone="success" dot /> : null}
                {ride.driverWomenVerified ? <Badge label={t('pax.women.driverBadge')} tone="lime" /> : null}
              </Row>
            ) : null}

            <Row style={{ gap: 10, marginTop: space[4] }}>
              {phase === 'in-trip' ? (
                <>
                  <Button label={live ? t('pax.share.live') : t('common.shareTrip')} icon={Share2} variant="outline" size="md" full={false} style={{ flex: 1 }} loading={sharing} onPress={shareTrip} />
                  <Button label="SOS" icon={ShieldAlert} variant="danger" size="md" full={false} onPress={() => router.push('/passenger/safety')} />
                </>
              ) : (
                // Trip chat (stored with the trip) and a direct call — the server only
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
                  <IconButton icon={Share2} label={live ? t('pax.share.live') : t('common.shareTrip')} onPress={shareTrip} size={48} />
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
              <Animated.View entering={ZoomIn.springify()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' }}>
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
                  {t(live && !ride.paid ? 'pax.ride.payWith' : 'pax.ride.paidWith', { method: paymentLabel(ride.payment, t) })}
                </Txt>
                <Txt v="caption" color={colors.inkMuted}>
                  {km(fare.distanceKm)} · {minutes(fare.durationMin)}
                </Txt>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Money value={cop(fare.finalFare - discount + tip)} size={28} />
                {discount ? (
                  <Txt v="caption" color={colors.limeInk}>
                    {t('pax.promo.saved', { amount: cop(discount) })}
                  </Txt>
                ) : null}
              </View>
            </Row>

            {/* Cash, Nequi, Daviplata, Bancolombia go straight to the driver: show exactly how.
                A card is paid in the app, below the tip (fare + tip in one charge). */}
            {live && ride.payment !== 'card' ? directBox(cop(fare.finalFare - discount + tip)) : null}

            <Txt v="h3" align="center" style={{ marginTop: space[5] }}>
              {t('pax.ride.howWasIt', { name: ride.driver?.name.split(' ')[0] ?? t('pax.ride.yourDriver') })}
            </Txt>
            <Row style={{ justifyContent: 'center', gap: 6, marginTop: space[3] }} accessibilityRole="adjustable" accessibilityLabel={t('pax.ride.ratingA11y', { n: stars })}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Tap key={s} onPress={() => setStars(s)} accessibilityLabel={t('common.starsCount', { n: s })} scaleTo={0.85}>
                  <Star size={38} color={s <= stars ? colors.lime : colors.ivory400} fill={s <= stars ? colors.lime : 'transparent'} strokeWidth={1.6} />
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
              {[0, 2000, 3000, 5000].map((v) => (
                // Once paid by card the tip is final (it went with the charge).
                <Chip key={v} label={v ? cop(v) : t('pax.ride.tipNone')} active={tip === v} onPress={() => !ride.paid && setTip(v)} style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 6 }} />
              ))}
            </Row>
            {live && ride.payment === 'card' && ride.tripId ? (
              <CardPayment
                tripId={ride.tripId}
                amount={fare.finalFare - discount + tip}
                tip={tip}
                paid={!!ride.paid}
                onPaid={() => app.patchRide({ paid: true })}
                driverName={ride.driver?.name.split(' ')[0] ?? t('pax.ride.yourDriver')}
                onSwitched={onSwitchedToDirect}
              />
            ) : null}
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
              <Stars value={ride.rating ?? 5} size={12} color={colors.limeOnDark} empty={colors.midnight500} />
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
                {live && ride.payment === 'card' && !ride.paid ? t('pax.cardpay.toPay') : t('pax.ride.totalPaid')}
              </Txt>
              <Txt v="title" tabular>
                {cop(fare.finalFare - discount + (ride.tip ?? 0))}
              </Txt>
            </Row>
            {/* Rated before paying by card: the payment is still here (rating never blocks it). */}
            {live && ride.payment === 'card' && ride.tripId ? (
              <View style={{ alignSelf: 'stretch' }}>
                <CardPayment
                  tripId={ride.tripId}
                  amount={fare.finalFare - discount + (ride.tip ?? 0)}
                  tip={ride.tip ?? 0}
                  paid={!!ride.paid}
                  onPaid={() => app.patchRide({ paid: true })}
                  driverName={ride.driver?.name.split(' ')[0] ?? t('pax.ride.yourDriver')}
                  onSwitched={onSwitchedToDirect}
                />
              </View>
            ) : null}
            {/* …or the card failed after rating and the passenger now pays the driver directly. */}
            {live && switchedFromCard && ride.payment !== 'card' ? <View style={{ alignSelf: 'stretch' }}>{directBox(cop(fare.finalFare - discount + (ride.tip ?? 0)))}</View> : null}
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
