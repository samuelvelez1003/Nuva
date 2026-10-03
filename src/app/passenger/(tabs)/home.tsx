import React, { useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Href, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Briefcase, Heart, House, LocateFixed, MapPin, Plus, Search, ShieldCheck } from 'lucide-react-native';
import { CityMap } from '../../../components/map/CityMap';
import { UserDot } from '../../../components/map/Markers';
import { IconButton, Tap } from '../../../components/ui/Button';
import { Avatar, Row } from '../../../components/ui/primitives';
import { useStatusTone } from '../../../components/ui/Screen';
import { Txt } from '../../../components/ui/Txt';
import { CURRENT_LOCATION, Place, placeById, POPULAR_IDS } from '../../../data/places';
import { buildRoute, offset, routeMetrics, trafficNow } from '../../../lib/geo';
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
        height: 40,
        paddingLeft: 6,
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
        <Icon size={14} color={colors.midnight} strokeWidth={2.4} />
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
  const { startQuote, ride } = useApp();
  const { profile } = useAuth();
  const location = useLocation();
  const { home, work, favorites } = useSavedPlaces();
  const here = location.here;
  useStatusTone('dark');

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
    const of = (p: Place) => minutes(routeMetrics(buildRoute(here, p), t).durationMin);
    return Object.fromEntries([home, work, ...favorites, ...popular].filter(Boolean).map((p) => [p!.id, of(p!)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here.lat, here.lng, home, work, favorites]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.ivory200 }}>
      <CityMap
        focus={[offset(here, -750, -700), offset(here, 750, 250)]}
        insets={{ top: insets.top + 60, bottom: 300, left: 0, right: 0 }}
        minSpan={150}
        renderMarkers={(toScreen) => <UserDot pos={toScreen(here)} />}
      />

      {/* Top floating bar */}
      <Animated.View
        entering={FadeInDown.duration(500)}
        style={{ position: 'absolute', top: insets.top + 8, left: space[4], right: space[4], flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <Tap onPress={() => router.navigate('/passenger/profile')} accessibilityLabel={t('pax.home.openProfile')} style={[{ borderRadius: 24 }, shadow.soft]}>
          <Avatar initials={initialsOf(profile?.full_name) || t('common.youInitials')} size={46} bg={colors.midnight} fg={colors.lime} ring={colors.white} image={profile?.avatar_url} />
        </Tap>
        <Tap
          onPress={location.status === 'granted' ? undefined : location.request}
          accessibilityLabel={location.status === 'granted' ? t('pax.home.youAreIn', { area: here.address }) : t('pax.home.enableLocation')}
          style={[{ flex: 1, height: 46, borderRadius: radius.pill, paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center' }, glass.light, shadow.soft]}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: location.status === 'granted' ? colors.midnight : colors.warning }} />
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
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 78 }}>
        <Row style={{ justifyContent: 'flex-end', paddingHorizontal: space[4], marginBottom: 12 }}>
          {ride && ride.phase !== 'quote' && ride.phase !== 'rated' ? (
            <Tap onPress={() => router.push('/passenger/ride')} style={[{ flex: 1, marginRight: 10, height: 46, borderRadius: radius.pill, backgroundColor: colors.midnight, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 }, shadow.soft]}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime }} />
              <Txt v="smallStrong" color={colors.ivory}>
                {t('pax.home.activeRide')}
              </Txt>
            </Tap>
          ) : null}
          <IconButton icon={LocateFixed} label={t('pax.home.centerMe')} size={46} onPress={location.request} />
        </Row>

        <Animated.View
          entering={FadeInUp.duration(600).springify().damping(18)}
          style={[{ marginHorizontal: space[3], borderRadius: radius.xxl, backgroundColor: colors.white, paddingTop: space[3], paddingBottom: space[3] }, shadow.float]}
        >
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
                paddingLeft: 20,
                paddingRight: 7,
                gap: 12,
              }}
            >
              <Txt v="h3" style={{ flex: 1 }}>
                {t('common.whereTo')}
              </Txt>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center' }}>
                <Search size={19} color={colors.lime} strokeWidth={2.6} />
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
              style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.lineLightStrong, alignItems: 'center', justifyContent: 'center' }}
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
      </View>
    </View>
  );
}
