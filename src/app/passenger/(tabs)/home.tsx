import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, ScrollView, View } from 'react-native';
import { Href, router, useFocusEffect } from 'expo-router';
import { fetchMyActiveTrip } from '../../../lib/liveTrips';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, SharedValue, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Briefcase, Heart, House, LocateFixed, MapPin, Plus, Search, ShieldCheck } from 'lucide-react-native';
import { Aurora } from '../../../components/brand/Aurora';
import { CityMap } from '../../../components/map/CityMap';
import { PlacePin, UserDot } from '../../../components/map/Markers';
import { ScheduledTripsList, useScheduledTrips } from '../../../components/trip/ScheduledTrips';
import { Button, haptic, IconButton, Tap } from '../../../components/ui/Button';
import { Avatar, Row } from '../../../components/ui/primitives';
import { useStatusTone, useToast } from '../../../components/ui/Screen';
import { Txt } from '../../../components/ui/Txt';
import { CURRENT_LOCATION, Place, placeById, POPULAR_IDS } from '../../../data/places';
import { buildRoute, LatLng, offset, routeMetrics, trafficNow } from '../../../lib/geo';
import { reverseGeocode } from '../../../lib/geocode';
import { minutes } from '../../../lib/format';
import { useLocation } from '../../../lib/location';
import { useSavedPlaces } from '../../../lib/savedPlaces';
import { useApp } from '../../../store/AppStore';
import { useAuth } from '../../../store/Auth';
import { useT } from '../../../i18n';
import { colors, glass, radius, shadow, space } from '../../../theme/tokens';

/** "Valentina Ríos" → "VR"; empty when there's no name (caller supplies the fallback). */
const initialsOf = (name?: string | null) =>
  (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/** Quiet pill shortcut: icon, name, ETA. Only "Casa" carries the accent. */
function ShortcutPill({ icon: Icon, label, sub, onPress, accent }: { icon: typeof House; label: string; sub?: string; onPress: () => void; accent?: boolean }) {
  return (
    <Tap
      onPress={onPress}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      style={{
        height: 44,
        paddingLeft: 8,
        paddingRight: 14,
        borderRadius: radius.pill,
        backgroundColor: accent ? colors.midnight : colors.white,
        borderWidth: accent ? 0 : 1,
        borderColor: colors.lineLight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: accent ? colors.lime : colors.ivory100, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color={accent ? colors.onLime : colors.midnight} strokeWidth={2.4} />
      </View>
      <Txt v="smallStrong" color={accent ? colors.ivory : colors.ink} numberOfLines={1}>
        {label}
      </Txt>
      {sub ? (
        <Txt v="caption" color={accent ? colors.onDarkMuted : colors.inkMuted} numberOfLines={1}>
          {sub}
        </Txt>
      ) : null}
    </Tap>
  );
}

/**
 * Grabber of the bottom panel. Drag it down (or tap it) to lower the panel and free the
 * map; drag it up to bring the panel back. `drag` follows the finger meanwhile.
 */
function PanelHandle({ lowered, onChange, label, drag }: { lowered: boolean; onChange: (lowered: boolean) => void; label: string; drag: SharedValue<number> }) {
  const state = useRef({ lowered, onChange });
  useLayoutEffect(() => {
    state.current = { lowered, onChange };
  });
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        // Only the way that makes sense follows the finger (a little give the other way).
        onPanResponderMove: (_e, g) => {
          drag.set(state.current.lowered ? Math.max(-140, Math.min(16, g.dy)) : Math.max(-16, Math.min(220, g.dy)));
        },
        onPanResponderRelease: (_e, g) => {
          drag.set(withSpring(0, { damping: 20, stiffness: 220 }));
          const { lowered: down, onChange: change } = state.current;
          if (Math.abs(g.dy) < 8 && Math.abs(g.dx) < 8) change(!down);
          else if (!down && g.dy > 40) change(true);
          else if (down && g.dy < -40) change(false);
        },
        onPanResponderTerminate: () => {
          drag.set(withSpring(0, { damping: 20, stiffness: 220 }));
        },
      }),
    [drag],
  );
  return (
    <View
      {...pan.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => onChange(!lowered)}
      style={[{ height: 24, alignItems: 'center', justifyContent: 'center' }, { cursor: 'grab' } as object]}
    >
      <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.ivory300 }} />
    </View>
  );
}

export default function PassengerHome() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { startQuote, ride, resumeRide, homePickup, setHomePickup } = useApp();
  const toast = useToast();
  const { profile, live, session } = useAuth();
  const location = useLocation();
  const { home, work, favorites } = useSavedPlaces();
  const here = location.here;
  /** Where the next trip starts: the point placed by hand on the map, else the GPS. */
  const origin = homePickup ?? here;
  useStatusTone('dark');

  // ── Panel lowered: the map is free and the pin fixed in its centre picks the pickup ──
  const [mapMode, setMapMode] = useState(false);
  const [pinStart, setPinStart] = useState<LatLng>({ lat: origin.lat, lng: origin.lng });
  const [recenter, setRecenter] = useState(0);
  const [pin, setPin] = useState<{ point: LatLng; address: string | null; area: string; locating: boolean }>({ point: pinStart, address: null, area: '', locating: false });
  const pinSeq = useRef(0);
  const drag = useSharedValue(0);
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));
  const openMap = (from: Place = origin) => {
    pinSeq.current++;
    setPinStart({ lat: from.lat, lng: from.lng });
    setRecenter((n) => n + 1);
    setPin({ point: { lat: from.lat, lng: from.lng }, address: from.address || from.name || null, area: from.area || '', locating: false });
    setMapMode(true);
    haptic();
  };
  const onPanel = (lowered: boolean) => (lowered ? openMap() : setMapMode(false));
  const onPinMove = (c: LatLng) => {
    setPin({ point: c, address: null, area: '', locating: true });
    const seq = ++pinSeq.current;
    reverseGeocode(c).then((r) => {
      if (seq === pinSeq.current) setPin({ point: c, address: r?.address ?? null, area: r?.area ?? '', locating: false });
    });
  };
  const confirmPickup = () => {
    const c = pin.point;
    const name = pin.address || t('pax.pin.point');
    setHomePickup({ id: `pin-${c.lat.toFixed(5)},${c.lng.toFixed(5)}`, kind: 'poi', name, address: name, area: pin.area, lat: c.lat, lng: c.lng });
    setMapMode(false);
    haptic('success');
    toast(t('pax.home.pickupSet', { place: name }));
  };
  /** Locate button: back to the GPS (drops a hand-placed pickup; in map mode, the pin jumps there). */
  const centerOnGps = () => {
    setHomePickup(null);
    location.request();
    if (mapMode) openMap(here);
  };

  // A trip still open on the server (app closed mid-ride) comes back on screen, so the
  // passenger can follow or cancel it instead of being blocked from requesting another.
  const rideOpen = !!ride && ride.phase !== 'quote' && ride.phase !== 'rated';
  useFocusEffect(
    useCallback(() => {
      const uid = session?.user.id;
      if (!live || !uid || rideOpen) return;
      fetchMyActiveTrip('passenger', uid)
        .then((trip) => {
          if (!trip) return;
          resumeRide(trip);
          router.push('/passenger/ride');
        })
        .catch(() => {});
    }, [live, session?.user.id, rideOpen, resumeRide]),
  );

  // Scheduled trips: listed here until they're offered to drivers (15 min before pickup).
  // From 20 min before, check every 30 s so the ride screen opens once it's released.
  const { trips: scheduled, reload: reloadScheduled } = useScheduledTrips();
  useEffect(() => {
    const uid = session?.user.id;
    if (!live || !uid || !scheduled.length || rideOpen) return;
    const check = () => {
      const soon = scheduled.some((s) => s.scheduled_for && new Date(s.scheduled_for).getTime() - Date.now() < 20 * 60_000);
      if (!soon) return;
      fetchMyActiveTrip('passenger', uid)
        .then((trip) => {
          if (!trip) return;
          resumeRide(trip);
          reloadScheduled();
          router.push('/passenger/ride');
        })
        .catch(() => {});
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [live, session?.user.id, scheduled, rideOpen, resumeRide, reloadScheduled]);

  // A ride-hailing app needs the pickup point: ask once when the home opens.
  useEffect(() => {
    if (location.status === 'unknown') location.request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (p: Place) => {
    startQuote(p);
    router.push('/passenger/ride');
  };
  const addPlace = (kind: 'home' | 'work' | 'favorite') => router.push(`/passenger/saved?add=${kind}` as Href);

  // The active country's popular destinations, until the passenger saves their own.
  const popular = POPULAR_IDS.map(placeById).filter(Boolean) as Place[];

  const eta = useMemo(() => {
    const t = trafficNow();
    const of = (p: Place) => minutes(routeMetrics(buildRoute(origin, p), t).durationMin);
    return Object.fromEntries([home, work, ...favorites, ...popular].filter(Boolean).map((p) => [p!.id, of(p!)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin.lat, origin.lng, home, work, favorites]);
  const granted = location.status === 'granted';

  return (
    <View style={{ flex: 1, backgroundColor: colors.ivory100 }}>
      <CityMap
        focus={mapMode ? [offset(pinStart, -300, -300), offset(pinStart, 300, 300)] : [offset(origin, -750, -700), offset(origin, 750, 250)]}
        insets={mapMode ? { top: insets.top + 70, bottom: insets.bottom + 78 + 250, left: 0, right: 0 } : { top: insets.top + 60, bottom: 300, left: 0, right: 0 }}
        minSpan={mapMode ? 60 : 150}
        onPinMove={mapMode ? onPinMove : undefined}
        recenter={recenter}
        renderMarkers={(toScreen) => (
          <>
                {granted || !homePickup ? <UserDot pos={toScreen(here)} /> : null}
                {homePickup && !mapMode ? <PlacePin pos={toScreen(homePickup)} kind="pickup" /> : null}
          </>
        )}
      />

      {/* Aurora wash behind the header: soft light over the top of the map, never touchable. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 190 }}>
        <Aurora layout="app" intensity={0.7} />
      </View>

      {/* Top floating bar */}
      <Animated.View
        entering={FadeInDown.duration(500)}
        style={{ position: 'absolute', top: insets.top + 8, left: space[4], right: space[4], flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <Tap onPress={() => router.navigate('/passenger/profile')} accessibilityLabel={t('pax.home.openProfile')} style={[{ borderRadius: 24 }, shadow.soft]}>
          <Avatar initials={initialsOf(profile?.full_name) || t('common.youInitials')} size={46} bg={colors.midnight} fg={colors.ivory} ring={colors.white} image={profile?.avatar_url} />
        </Tap>
        {/* Where we pick you up: the hand-placed point, else the GPS. Tapping it opens the map to move it. */}
        <Tap
          onPress={homePickup || granted ? () => openMap() : location.request}
          accessibilityLabel={homePickup ? `${t('pax.home.pickupAt')} ${homePickup.address}. ${t('pax.home.mapMode')}` : granted ? t('pax.home.youAreIn', { area: here.address }) : t('pax.home.enableLocation')}
          style={[{ flex: 1, height: 46, borderRadius: radius.pill, paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center' }, glass.light, shadow.soft]}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: homePickup || granted ? colors.lime : colors.warning }} />
          <View style={{ flex: 1 }}>
            <Txt v="caption" color={colors.inkMuted}>
              {homePickup ? t('pax.home.pickupAt') : granted ? t('pax.home.youAreIn', { area: here.area || CURRENT_LOCATION.area }) : t('pax.home.locationOff')}
            </Txt>
            <Txt v="smallStrong" numberOfLines={1}>
              {homePickup ? homePickup.address : granted ? here.address : t('pax.home.tapToEnableGps')}
            </Txt>
          </View>
        </Tap>
        <IconButton icon={ShieldCheck} label={t('common.safetyCenter')} onPress={() => router.push('/passenger/safety')} size={46} />
      </Animated.View>

      {/* Bottom composition: locate button + main card */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 78 }}>
        <Row style={{ justifyContent: 'flex-end', paddingHorizontal: space[4], marginBottom: 12 }}>
          {ride && ride.phase !== 'quote' && ride.phase !== 'rated' ? (
            <Tap onPress={() => router.push('/passenger/ride')} style={[{ flex: 1, marginRight: 10, height: 46, borderRadius: radius.pill, backgroundColor: colors.midnight, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 }, shadow.soft]}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: colors.coral }} />
              <Txt v="smallStrong" color={colors.ivory}>
                {t('pax.home.activeRide')}
              </Txt>
            </Tap>
          ) : null}
          <IconButton icon={LocateFixed} label={homePickup ? t('pax.home.useGps') : t('pax.home.centerMe')} size={46} onPress={centerOnGps} />
        </Row>

        {mapMode ? (
          // Panel lowered: only the pickup under the pin and its confirmation.
          <Animated.View
            key="pin"
            entering={FadeInUp.duration(320)}
            style={[{ marginHorizontal: space[3], borderRadius: radius.xxl, backgroundColor: colors.white, paddingBottom: space[4] }, shadow.float, dragStyle]}
          >
            <PanelHandle lowered onChange={onPanel} label={t('pax.home.showPanel')} drag={drag} />
            <View style={{ paddingHorizontal: space[4], gap: 10 }}>
              <Txt v="overline" color={colors.inkMuted}>
                {t('pax.home.pickupTitle')}
              </Txt>
              <Row style={{ gap: 12 }} accessibilityLiveRegion="polite">
                <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 4, borderColor: colors.midnight }} />
                <Txt v="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>
                  {pin.locating ? t('pax.pin.locating') : pin.address || t('pax.pin.point')}
                </Txt>
              </Row>
              <Txt v="caption" color={colors.inkMuted}>
                {t('pax.home.pickupHint')}
              </Txt>
              <Button label={t('pax.home.confirmPickup')} onPress={confirmPickup} disabled={pin.locating} style={{ marginTop: 4 }} />
            </View>
          </Animated.View>
        ) : (
          <>
        {/* The next scheduled trip (the rest in Viajes). */}
        <ScheduledTripsList
          trips={scheduled}
          onChanged={reloadScheduled}
          limit={1}
          floating
          onMore={() => router.navigate('/passenger/trips')}
          style={{ marginHorizontal: space[3], marginBottom: 10 }}
        />

        <Animated.View
          key="panel"
          entering={FadeInUp.duration(600).springify().damping(18)}
          style={[{ marginHorizontal: space[3], borderRadius: radius.xxl, backgroundColor: colors.white, paddingBottom: space[3] }, shadow.float, dragStyle]}
        >
          {/* Drag down (or tap) to lower the panel and move the map to the exact pickup. */}
          <PanelHandle lowered={false} onChange={onPanel} label={t('pax.home.mapMode')} drag={drag} />

          {/* Search: one quiet field, one accent (the go button) */}
          <View style={{ paddingHorizontal: space[3] }}>
            <Tap
              onPress={() => router.push('/passenger/search')}
              accessibilityLabel={t('pax.home.searchA11y')}
              scaleTo={0.98}
              style={{
                height: 58,
                borderRadius: radius.pill,
                backgroundColor: colors.ivory100,
                flexDirection: 'row',
                alignItems: 'center',
                paddingLeft: 18,
                paddingRight: 7,
                gap: 12,
              }}
            >
              <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colors.coral }} />
              <Txt v="h3" style={{ flex: 1 }}>
                {t('common.whereTo')}
              </Txt>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
                <Search size={19} color={colors.onLime} strokeWidth={2.6} />
              </View>
            </Tap>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space[3], gap: 6, paddingTop: 12 }}>
            {home ? <ShortcutPill icon={House} label={t('common.home')} sub={eta[home.id]} onPress={() => go(home)} accent /> : <ShortcutPill icon={House} label={t('pax.home.addHome')} onPress={() => addPlace('home')} accent />}
            {work ? <ShortcutPill icon={Briefcase} label={t('common.work')} sub={eta[work.id]} onPress={() => go(work)} /> : <ShortcutPill icon={Briefcase} label={t('pax.home.addWork')} onPress={() => addPlace('work')} />}
            {favorites.map((f) => (
              <ShortcutPill key={f.id} icon={Heart} label={f.label ?? f.name} sub={eta[f.id]} onPress={() => go(f)} />
            ))}
            <Tap
              onPress={() => router.push('/passenger/saved')}
              accessibilityLabel={t('pax.home.manageSaved')}
              style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.lineLightStrong, alignItems: 'center', justifyContent: 'center' }}
            >
              <Plus size={16} color={colors.inkMuted} />
            </Tap>
          </ScrollView>

          <View style={{ paddingHorizontal: space[5], marginTop: 8 }}>
            {popular.slice(0, 2).map((p) => (
              <Tap key={p.id} onPress={() => go(p)} scaleTo={0.985} accessibilityLabel={t('pax.home.goTo', { place: p.name })}>
                <Row style={{ paddingVertical: 9, gap: 12 }}>
                  <MapPin size={16} color={colors.stone} />
                  <Txt v="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                    {p.name}
                    <Txt v="small" color={colors.inkMuted}>
                      {'  '}
                      {p.area}
                    </Txt>
                  </Txt>
                  <Txt v="caption" color={colors.inkMuted}>
                    {eta[p.id]}
                  </Txt>
                </Row>
              </Tap>
            ))}
          </View>
        </Animated.View>
          </>
        )}
      </View>
    </View>
  );
}
