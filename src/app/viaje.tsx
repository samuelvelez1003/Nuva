import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import Head from 'expo-router/head';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinkIcon, PhoneCall, Star } from 'lucide-react-native';
import { Wordmark } from '../components/brand/Brand';
import { CityMap } from '../components/map/CityMap';
import { CarMarker, PlacePin } from '../components/map/Markers';
import { Button } from '../components/ui/Button';
import { Avatar, LiveDot, Row } from '../components/ui/primitives';
import { useStatusTone } from '../components/ui/Screen';
import { Txt } from '../components/ui/Txt';
import { TKey, useT } from '../i18n';
import { addMinutes, clock } from '../lib/format';
import { offset } from '../lib/geo';
import { fetchSharedTrip, SharedTrip, TripStatus } from '../lib/liveTrips';
import { fetchStreetRoute, ROUTE_REFRESH_MS, RouteResult } from '../lib/routing';
import { colors, fonts, radius, space } from '../theme/tokens';

const POLL_MS = 10_000;

const STATUS: Record<TripStatus, TKey> = {
  requested: 'share.status.requested',
  accepted: 'share.status.accepted',
  arriving: 'share.status.arriving',
  in_progress: 'share.status.inProgress',
  completed: 'share.status.completed',
  cancelled: 'share.status.cancelled',
};

const plateText = (p?: string) => (p ? `${p.slice(0, 3)} ${p.slice(3)}`.trim() : '—');

/**
 * Public page of a shared trip (/viaje?t=TOKEN): whoever receives the passenger's link
 * follows the trip live without an account — status, driver, vehicle, plate and the car
 * on the map. Refreshed every 10 s; the server stops answering 30 min after the trip ends.
 */
export default function SharedTripPage() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { t: token } = useLocalSearchParams<{ t?: string }>();
  const tok = typeof token === 'string' ? token.trim() : '';
  // undefined: loading the first time; null: the link isn't active (or never was).
  const [loaded, setTrip] = useState<SharedTrip | null | undefined>(undefined);
  // Static rendering has no query string: it renders the loading state, never "not active".
  const trip = tok ? loaded : typeof window === 'undefined' ? undefined : null;
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useStatusTone(trip ? 'light' : 'dark');

  useEffect(() => {
    if (!tok) return;
    let alive = true;
    const load = () =>
      fetchSharedTrip(tok)
        .then((s) => {
          if (!alive) return;
          setTrip(s);
          setUpdatedAt(new Date());
        })
        // A network blip keeps what is on screen; only the first failure shows "not active".
        .catch(() => alive && setTrip((cur) => (cur === undefined ? null : cur)));
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [tok]);

  // While the trip is on: the street route with live traffic from the car to where it's
  // heading (pickup or destination), refreshed every ~75 s. No car position → no route.
  const [leg, setLeg] = useState<{ code: string; r: RouteResult | null } | null>(null);
  const live = loaded && (loaded.status === 'accepted' || loaded.status === 'arriving' || loaded.status === 'in_progress') && loaded.position ? loaded : null;
  const liveRef = useRef(live);
  useEffect(() => {
    liveRef.current = live;
  });
  const liveKey = live ? `${live.code}|${live.status}` : '';
  useEffect(() => {
    if (!liveKey) return;
    let alive = true;
    const load = () => {
      const s = liveRef.current;
      if (!s?.position) return;
      const to = s.status === 'in_progress' ? s.destination : s.pickup;
      fetchStreetRoute(s.position, to, { fresh: true }).then((r) => {
        // A failed refresh keeps the last street route.
        if (alive && r) setLeg({ code: s.code, r });
      });
    };
    load();
    const id = setInterval(load, ROUTE_REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [liveKey]);

  const head = (
    <Head>
      <title>{t('share.metaTitle')}</title>
      <meta name="robots" content="noindex, nofollow" />
    </Head>
  );

  if (trip === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ivory100, alignItems: 'center', justifyContent: 'center', gap: space[4] }}>
        {head}
        <Wordmark height={34} color={colors.midnight} />
        <ActivityIndicator color={colors.midnight} />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ivory100, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[4] }}>
        {head}
        <Wordmark height={34} color={colors.midnight} />
        <View style={{ width: 80, height: 80, borderRadius: 28, backgroundColor: colors.limeSoft, alignItems: 'center', justifyContent: 'center', marginTop: space[5] }}>
          <LinkIcon size={34} color={colors.limeInk} />
        </View>
        <Txt v="h2" align="center" color={colors.midnight}>
          {t('share.inactiveTitle')}
        </Txt>
        <Txt v="body" align="center" color={colors.inkSoft} style={{ maxWidth: 380 }}>
          {t('share.inactiveBody')}
        </Txt>
        <Button label={t('share.cta')} full={false} onPress={() => router.replace('/')} style={{ marginTop: space[3] }} />
      </View>
    );
  }

  const active = trip.status === 'accepted' || trip.status === 'arriving' || trip.status === 'in_progress';
  const pos = active ? trip.position : null;
  const toward = trip.status === 'in_progress' ? trip.destination : trip.pickup;
  const focus = pos
    ? [pos, toward]
    : trip.status === 'requested'
      ? [offset(trip.pickup, -500, -500), offset(trip.pickup, 500, 500)]
      : [trip.pickup, trip.destination];
  const v = trip.driver?.vehicle;
  const car = [v?.brand, v?.model].filter(Boolean).join(' ');
  // Live traffic ETA from where the car is (refreshed every ~75 s); the server's estimate until then.
  const liveEta = trip.status === 'in_progress' && pos && leg?.code === trip.code && leg.r ? new Date(leg.r.at + leg.r.durationMin * 60_000) : null;
  const eta = liveEta ? clock(liveEta) : trip.status === 'in_progress' && trip.startedAt ? clock(addMinutes(new Date(trip.startedAt), trip.durationMin)) : null;
  const legRoute = pos && leg?.code === trip.code && leg.r ? leg.r.points : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ivory100 }}>
      {head}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space[8] }}>
        <View style={{ backgroundColor: colors.midnight, paddingTop: insets.top + space[4], paddingBottom: space[4], paddingHorizontal: space[5] }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Wordmark height={22} color={colors.ivory} />
            <Txt v="caption" color={colors.onDarkMuted}>
              {t('share.code', { code: trip.code })}
            </Txt>
          </Row>
          <Row style={{ gap: 10, marginTop: space[4] }}>
            {active || trip.status === 'requested' ? <LiveDot size={9} /> : null}
            <Txt v="h2" color={colors.ivory} style={{ flex: 1 }}>
              {t(STATUS[trip.status], { name: trip.passenger, place: trip.destination.name })}
            </Txt>
          </Row>
          {eta ? (
            <Txt v="body" color={colors.limeOnDark} style={{ marginTop: 4 }}>
              {t('share.eta', { time: eta })}
            </Txt>
          ) : null}
        </View>

        {/* The car on the map while the trip is on (its last position from the last 5 minutes). */}
        <View style={{ height: 320 }}>
          <CityMap
            focus={focus}
            minSpan={110}
            insets={{ top: 40, bottom: 40, left: 40, right: 40 }}
            route={legRoute}
            renderMarkers={(toScreen) => (
              <>
                {trip.status !== 'in_progress' && trip.status !== 'completed' ? <PlacePin pos={toScreen(trip.pickup)} kind="pickup" title={trip.pickup.name} /> : null}
                {trip.status !== 'accepted' && trip.status !== 'arriving' && trip.status !== 'requested' ? (
                  <PlacePin pos={toScreen(trip.destination)} kind="dropoff" title={trip.destination.name} />
                ) : null}
                {pos ? <CarMarker pos={toScreen(pos)} heading={pos.heading ?? 0} /> : null}
              </>
            )}
          />
        </View>

        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space[5], marginTop: space[4], gap: space[3] }}>
          {active && !pos ? (
            <Txt v="caption" color={colors.inkMuted}>
              {t('share.noPosition')}
            </Txt>
          ) : null}

          {trip.driver ? (
            <Row style={{ gap: 14, padding: 14, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineLight }}>
              <Avatar initials={trip.driver.name.slice(0, 1).toUpperCase()} size={52} bg={colors.midnight} fg={colors.ivory} image={trip.driver.avatar} />
              <View style={{ flex: 1 }}>
                <Txt v="caption" color={colors.inkMuted}>
                  {t('share.driver')}
                </Txt>
                <Txt v="title" numberOfLines={1}>
                  {trip.driver.name}
                </Txt>
                <Row style={{ gap: 6, marginTop: 2 }}>
                  <Star size={13} color={colors.ink} fill={colors.ink} />
                  <Txt v="caption" tabular>
                    {(Number(trip.driver.rating) || 5).toFixed(2).replace('.', ',')}
                  </Txt>
                  {car || v?.color ? (
                    <Txt v="caption" color={colors.inkMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
                      · {[car, v?.color].filter(Boolean).join(' · ')}
                    </Txt>
                  ) : null}
                </Row>
              </View>
              <View style={{ backgroundColor: '#F6CB2F', borderRadius: 6, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Txt style={{ fontFamily: fonts.extrabold, fontSize: 17, letterSpacing: 1.2 }} color={colors.ink}>
                  {plateText(v?.plate)}
                </Txt>
              </View>
            </Row>
          ) : null}

          <View style={{ padding: 14, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineLight, gap: 10 }}>
            <View>
              <Txt v="caption" color={colors.inkMuted}>
                {t('common.pickup')}
              </Txt>
              <Txt v="bodyStrong">{trip.pickup.name}</Txt>
            </View>
            <View style={{ height: 1, backgroundColor: colors.lineLight }} />
            <View>
              <Txt v="caption" color={colors.inkMuted}>
                {t('common.destination')}
              </Txt>
              <Txt v="bodyStrong">{trip.destination.name}</Txt>
            </View>
          </View>

          <Row style={{ gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: radius.md, backgroundColor: colors.ivory200 }}>
            <PhoneCall size={16} color={colors.inkSoft} style={{ marginTop: 2 }} />
            <Txt v="small" color={colors.inkSoft} style={{ flex: 1 }}>
              {t('share.emergency')}
            </Txt>
          </Row>

          {updatedAt ? (
            <Txt v="caption" color={colors.inkMuted} align="center">
              {t('share.updated', { time: clock(updatedAt) })}
            </Txt>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
