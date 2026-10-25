import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, ScrollView, View } from 'react-native';
import { Href, router, useFocusEffect } from 'expo-router';
import { fetchMyActiveTrip } from '../../../lib/liveTrips';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { Briefcase, Heart, House, LocateFixed, MapPin, MapPinned, Maximize2, Plus, Search, ShieldCheck, X } from 'lucide-react-native';
import { Aurora } from '../../../components/brand/Aurora';
import { CityMap } from '../../../components/map/CityMap';
import { PlacePin, UserDot } from '../../../components/map/Markers';
import { inServiceArea, PinPanel, useLocateMe, usePinAddress } from '../../../components/map/PinPicker';
import { ScheduledTripsList, useScheduledTrips } from '../../../components/trip/ScheduledTrips';
import { IconButton, Tap } from '../../../components/ui/Button';
import { CollapseHandle, useCollapseDrag } from '../../../components/ui/Collapsible';
import { Avatar, Row } from '../../../components/ui/primitives';
import { useStatusTone, useToast } from '../../../components/ui/Screen';
import { Txt } from '../../../components/ui/Txt';
import { CURRENT_LOCATION, Place, placeById, POPULAR_IDS } from '../../../data/places';
import { buildRoute, offset, routeMetrics, trafficNow } from '../../../lib/geo';
import { minutes } from '../../../lib/format';
import { useCountry } from '../../../lib/country';
import { useLocation } from '../../../lib/location';
import { addRecentPlace } from '../../../lib/recentPlaces';
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

export default function PassengerHome() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { startQuote, ride, resumeRide, pickupPin, setPickupPin } = useApp();
  const { profile, live, session } = useAuth();
  const location = useLocation();
  const { home, work, favorites } = useSavedPlaces();
  const { country } = useCountry();
  const toast = useToast();
  const here = location.here;
  // Where the trip starts: a point fixed on the map, or the phone's position.
  const pickup = pickupPin ?? here;
  useStatusTone('dark');

  // ── Map + panel: the "¿A dónde vamos?" panel lowers to a small bar to see and move the map ──
  const [collapsed, setCollapsed] = useState(false);
  const drag = useCollapseDrag(collapsed, setCollapsed);
  const [mapMoved, setMapMoved] = useState(false);
  const [recenter, setRecenter] = useState(0);
  // Space the bottom composition takes (measured), so the map frames itself above it.
  const [panelSpace, setPanelSpace] = useState(300);
  const onPanelLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height + insets.bottom + 78);
    setPanelSpace((cur) => (Math.abs(cur - h) < 6 ? cur : h));
  };

  // ── Pickup on the map (before choosing where to go): pin fixed in the centre ──
  const [pinMode, setPinMode] = useState(false);
  const [pinFocus, setPinFocus] = useState<{ lat: number; lng: number } | null>(null);
  const { pin, reset: resetPin, move: onPinMove } = usePinAddress();
  const startPin = () => {
    setPinFocus({ lat: pickup.lat, lng: pickup.lng });
    resetPin({ lat: pickup.lat, lng: pickup.lng }, pickup.address || pickup.name, pickup.area);
    setRecenter((n) => n + 1);
    setPinMode(true);
  };
  const closePin = () => {
    setPinMode(false);
    setRecenter((n) => n + 1);
  };
  const confirmPin = () => {
    const c = pin.point ?? pickup;
    const place: Place = {
      id: `pin-${c.lat.toFixed(5)},${c.lng.toFixed(5)}`,
      kind: 'poi',
      name: pin.address || t('pax.pin.point'),
      address: pin.address || t('pax.pin.point'),
      area: pin.area,
      lat: c.lat,
      lng: c.lng,
    };
    setPickupPin(place);
    addRecentPlace(place);
    toast(t('pax.pin.pickupSet', { place: place.name }));
    closePin();
  };
  const pinOnMe = useLocateMe(
    pinMode,
    (h) => {
      setPinFocus({ lat: h.lat, lng: h.lng });
      setRecenter((n) => n + 1);
      resetPin({ lat: h.lat, lng: h.lng }, h.address || h.name, h.area);
    },
    () => toast(t('pax.pin.noGps'), 'warning'),
  );
  const pinOutOfZone = pinMode && pin.point && !inServiceArea(pin.point, country.bounds) ? t('pax.pin.outOfZone', { city: country.cityLong }) : null;
  const pinAt = pinFocus ?? pickup;

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
    const of = (p: Place) => minutes(routeMetrics(buildRoute(pickup, p), t).durationMin);
    return Object.fromEntries([home, work, ...favorites, ...popular].filter(Boolean).map((p) => [p!.id, of(p!)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup.lat, pickup.lng, home, work, favorites]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.ivory100 }}>
      <CityMap
        focus={
          pinMode
            ? [offset(pinAt, -120, -120), offset(pinAt, 120, 120)]
            : pickupPin
              ? [offset(pickupPin, -400, -400), offset(pickupPin, 400, 400), here]
              : [offset(here, -750, -700), offset(here, 750, 250)]
        }
        insets={pinMode ? { top: insets.top + 70, bottom: panelSpace + 16, left: 40, right: 40 } : { top: insets.top + 60, bottom: panelSpace, left: 0, right: 0 }}
        minSpan={pinMode ? 90 : 150}
        // Free map (drag, pinch, wheel); in pin mode the map moves under a fixed pin.
        interactive
        onPinMove={pinMode ? onPinMove : undefined}
        recenterKey={`${pinMode ? 'pin' : 'home'}|${recenter}`}
        onUserMove={setMapMoved}
        renderMarkers={(toScreen) => (
          <>
            <UserDot pos={toScreen(here)} />
            {pickupPin && !pinMode ? <PlacePin pos={toScreen(pickupPin)} kind="pickup" title={t('pax.pin.pickupLabel')} /> : null}
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
        <Tap
          // With GPS on, the pill opens the map pin to fix the exact pickup point.
          onPress={location.status === 'granted' ? (pinMode ? undefined : startPin) : location.request}
          accessibilityLabel={
            location.status === 'granted' ? `${t('pax.home.youAreIn', { area: here.address })}. ${t('pax.pin.setPickup')}` : t('pax.home.enableLocation')
          }
          style={[{ flex: 1, height: 46, borderRadius: radius.pill, paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center' }, glass.light, shadow.soft]}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: location.status === 'granted' ? colors.lime : colors.warning }} />
          <View style={{ flex: 1 }}>
            <Txt v="caption" color={colors.inkMuted}>
              {location.status === 'granted' ? t('pax.home.youAreIn', { area: here.area || CURRENT_LOCATION.area }) : t('pax.home.locationOff')}
            </Txt>
            <Txt v="smallStrong" numberOfLines={1}>
              {location.status === 'granted' ? here.address : t('pax.home.tapToEnableGps')}
            </Txt>
          </View>
        </Tap>
        <IconButton icon={ShieldCheck} label={t('common.safetyCenter')} onPress={() => router.push('/passenger/safety')} size={46} />
      </Animated.View>

      {/* Bottom composition: locate button + main card */}
      <View pointerEvents="box-none" onLayout={onPanelLayout} style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 78 }}>
        <Row style={{ justifyContent: 'flex-end', paddingHorizontal: space[4], marginBottom: 12, gap: 10 }}>
          {!pinMode && ride && ride.phase !== 'quote' && ride.phase !== 'rated' ? (
            <Tap onPress={() => router.push('/passenger/ride')} style={[{ flex: 1, height: 46, borderRadius: radius.pill, backgroundColor: colors.midnight, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 }, shadow.soft]}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: colors.coral }} />
              <Txt v="smallStrong" color={colors.ivory}>
                {t('pax.home.activeRide')}
              </Txt>
            </Tap>
          ) : null}
          {/* Moved by hand: back to the framed view. */}
          {!pinMode && mapMoved ? (
            <Animated.View entering={FadeIn.duration(200)}>
              <IconButton icon={Maximize2} label={t('map.recenter')} size={46} onPress={() => setRecenter((n) => n + 1)} />
            </Animated.View>
          ) : null}
          {pinMode ? (
            <IconButton icon={LocateFixed} label={t('map.myLocation')} size={46} onPress={pinOnMe} />
          ) : (
            <IconButton
              icon={LocateFixed}
              label={t('pax.home.centerMe')}
              size={46}
              onPress={() => {
                location.request();
                setRecenter((n) => n + 1);
              }}
            />
          )}
        </Row>

        {pinMode ? (
          // Pickup pin: the panel says what's under the pin; confirm fixes it for the next trip.
          <Animated.View
            key="pin"
            entering={FadeInUp.duration(350)}
            style={[{ marginHorizontal: space[3], borderRadius: radius.xxl, backgroundColor: colors.white, paddingTop: space[4], paddingBottom: space[4] }, shadow.float]}
          >
            <PinPanel title={t('pax.pin.setPickup')} pin={pin} outOfZone={pinOutOfZone} confirmLabel={t('pax.pin.confirmPickup')} onConfirm={confirmPin} onCancel={closePin} />
          </Animated.View>
        ) : null}

        {/* The next scheduled trip (the rest in Viajes). Hidden while the panel is lowered. */}
        {!pinMode && !collapsed ? (
          <ScheduledTripsList
            trips={scheduled}
            onChanged={reloadScheduled}
            limit={1}
            floating
            onMore={() => router.navigate('/passenger/trips')}
            style={{ marginHorizontal: space[3], marginBottom: 10 }}
          />
        ) : null}

        {pinMode ? null : (
          <Animated.View
            key="panel"
            entering={FadeInUp.duration(600).springify().damping(18)}
            layout={LinearTransition.springify().damping(20)}
            style={{ marginHorizontal: space[3] }}
          >
            <Animated.View style={[{ borderRadius: radius.xxl, backgroundColor: colors.white, paddingTop: 8, paddingBottom: space[3] }, shadow.float, drag.dragStyle]}>
              {/* Drag or tap the handle (or the chevron) to lower the panel and see the map. */}
              <CollapseHandle collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} handlers={drag.handlers} />

              {/* Pickup: the phone's position, or a point fixed on the map. */}
              {collapsed ? null : (
                <Row style={{ paddingHorizontal: space[4], paddingBottom: 10, gap: 10 }}>
                  <Tap
                    onPress={startPin}
                    scaleTo={0.98}
                    accessibilityLabel={`${t('pax.pin.setPickup')}: ${pickup.address || pickup.name}`}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 }}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: pickupPin ? colors.midnight : colors.lime }} />
                    <View style={{ flex: 1 }}>
                      <Txt v="caption" color={colors.inkMuted} numberOfLines={1}>
                        {t('pax.pin.pickupLabel')} · {pickupPin ? t('pax.pin.point') : t('pax.pin.pickupGps')}
                      </Txt>
                      <Txt v="smallStrong" numberOfLines={1}>
                        {pickup.address || pickup.name}
                      </Txt>
                    </View>
                    <Row style={{ gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.ivory100 }}>
                      <MapPinned size={14} color={colors.ink} />
                      <Txt v="caption">{t('pax.pin.adjustShort')}</Txt>
                    </Row>
                  </Tap>
                  {pickupPin ? <IconButton icon={X} label={t('pax.pin.useGps')} tone="clear" size={34} onPress={() => setPickupPin(null)} /> : null}
                </Row>
              )}

              {/* Search: one quiet field, one accent (the go button). Stays in the lowered bar. */}
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

              {/* Hidden, not unmounted, while lowered. */}
              <View style={collapsed ? { display: 'none' } : undefined}>
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
              </View>
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
