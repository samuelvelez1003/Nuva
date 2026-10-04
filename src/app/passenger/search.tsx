import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, Briefcase, Clock3, Heart, House, MapPin, MapPinned, SearchX, X } from 'lucide-react-native';
import { RouteGlyph } from '../../components/brand/Brand';
import { IconButton, Tap } from '../../components/ui/Button';
import { EmptyState, Row } from '../../components/ui/primitives';
import { useStatusTone, useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { Place, PLACES } from '../../data/places';
import { buildRoute, routeMetrics } from '../../lib/geo';
import { normalizeAddress, resolveHit, SearchHit, searchPlaces } from '../../lib/geocode';
import { addRecentPlace, getRecentPlaces } from '../../lib/recentPlaces';
import { km } from '../../lib/format';
import { useLocation } from '../../lib/location';
import { useCountry } from '../../lib/country';
import { useT } from '../../i18n';
import { useSavedPlaces } from '../../lib/savedPlaces';
import { useApp } from '../../store/AppStore';
import { colors, fonts, radius, space } from '../../theme/tokens';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ICONS = { home: House, work: Briefcase, favorite: Heart, recent: Clock3, poi: MapPin, current: MapPinned };

type Section = { title: string; items: SearchHit[] };

export default function SearchDestination() {
  const insets = useSafeAreaInsets();
  const { startQuote, setPickup, ride } = useApp();
  const { here } = useLocation();
  const { for: purpose } = useLocalSearchParams<{ for?: string }>();
  const forPickup = purpose === 'pickup';
  const { code: countryCode, country } = useCountry();
  const t = useT();
  const { places: saved } = useSavedPlaces();
  // Addresses this passenger already found on this phone (newest first).
  const [recent] = useState(() => getRecentPlaces());
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState<SearchHit[]>([]);
  const toast = useToast();
  const [searching, setSearching] = useState(false);
  useStatusTone('dark');

  // Address search (Google Places, or OpenStreetMap as fallback), debounced.
  // `here` only biases results; it isn't a trigger.
  useEffect(() => {
    const text = q.trim();
    if (text.length < 3) {
      setRemote([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let alive = true;
    const t = setTimeout(async () => {
      const r = await searchPlaces(text, here);
      if (alive) {
        setRemote(r);
        setSearching(false);
      }
    }, 650);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const sections: Section[] = useMemo(() => {
    if (!q.trim()) {
      return [
        { title: t('pax.search.yourPlaces'), items: saved },
        { title: t('pax.search.recent'), items: recent },
        { title: t('pax.search.popularIn', { city: country.cityLong }), items: PLACES.filter((p) => p.kind === 'poi') },
      ].filter((s) => s.items.length);
    }
    const n = norm(q);
    const match = (p: Place) => norm(`${p.name} ${p.address} ${p.area} ${p.label ?? ''}`).includes(n);
    // Typed abbreviations ("Cra 7") also match recents saved as "Carrera 7".
    const nn = norm(normalizeAddress(q));
    const matchRecent = (p: Place) => match(p) || norm(`${p.name} ${p.address}`).includes(nn);
    const local = [...saved.filter(match), ...recent.filter(matchRecent), ...PLACES.filter((p) => p.kind === 'poi' && match(p))];
    // Drop OSM hits that duplicate a local place (within ~80 m).
    const dedup = remote.filter((r) => !local.some((l) => Math.abs(l.lat - r.lat) < 0.0007 && Math.abs(l.lng - r.lng) < 0.0007));
    return [
      { title: t('pax.search.matches'), items: local },
      { title: t('pax.search.addresses'), items: dedup },
    ].filter((s) => s.items.length);
  }, [q, saved, recent, remote, t, country.cityLong]);

  const rows = sections.flatMap((s) => s.items.map((item, i) => ({ item, header: i === 0 ? s.title : undefined })));

  const [resolving, setResolving] = useState<string | null>(null);
  const choose = async (p: SearchHit) => {
    if (resolving) return;
    setResolving(p.id);
    const place = await resolveHit(p);
    setResolving(null);
    if (!place) return toast(t('pax.search.notFoundToast'), 'warning');
    addRecentPlace(place);
    if (forPickup) {
      // Opened from the ride screen to choose where to be picked up.
      setPickup(place);
      return router.back();
    }
    startQuote(place);
    // navigate returns to a ride screen already open (changing the destination) instead
    // of stacking a second one, which left a blank screen on Back.
    router.navigate('/passenger/ride');
  };

  const renderPlace = ({ item: { item, header }, index }: { item: { item: SearchHit; header?: string }; index: number }) => {
    const Icon = ICONS[item.kind] ?? MapPin;
    // Google hits have no coordinates yet; they bring their own distance.
    const d = Number.isFinite(item.lat) ? routeMetrics(buildRoute(here, item)).distanceKm : item.distanceMeters != null ? item.distanceMeters / 1000 : null;
    const mine = item.kind === 'home';
    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 30).duration(280)}>
        {header ? (
          <Txt v="overline" color={colors.inkMuted} style={{ marginTop: space[5], marginBottom: 4 }}>
            {header}
          </Txt>
        ) : null}
        <Tap onPress={() => choose(item)} scaleTo={0.985} accessibilityLabel={`${item.name}, ${item.address}`}>
          <Row style={{ paddingVertical: 13, gap: 14 }}>
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: mine ? colors.midnight : colors.ivory200, alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={18} color={mine ? colors.lime : colors.ink} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt v="bodyStrong" numberOfLines={1}>
                {item.label && item.kind !== 'poi' ? item.label : item.name}
              </Txt>
              <Txt v="small" color={colors.inkMuted} numberOfLines={1}>
                {[item.address, item.area].filter(Boolean).join(' · ')}
              </Txt>
            </View>
            {resolving === item.id ? (
              <ActivityIndicator size="small" color={colors.inkMuted} />
            ) : d != null ? (
              <Txt v="caption" color={colors.inkMuted} tabular>
                {km(d)}
              </Txt>
            ) : null}
          </Row>
        </Tap>
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.white, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: space[4], paddingTop: space[2], paddingBottom: space[4], borderBottomWidth: 1, borderBottomColor: colors.lineLight }}>
        <Row style={{ gap: 4, marginBottom: space[3] }}>
          <IconButton icon={ArrowLeft} label={t('common.back')} tone="clear" onPress={() => router.back()} />
          <Txt v="h3">{forPickup ? t('pax.ride.wherePickup') : t('pax.search.title')}</Txt>
        </Row>
        <Row style={[{ backgroundColor: colors.ivory100, borderRadius: radius.lg, padding: 14, gap: 14 }]}>
          <RouteGlyph height={70} />
          <View style={{ flex: 1, gap: 8 }}>
            <View>
              <Txt v="caption" color={colors.inkMuted}>
                {t('common.pickup')}
              </Txt>
              <Txt v="bodyStrong" numberOfLines={1}>
                {here.address}
              </Txt>
            </View>
            <View style={{ height: 1, backgroundColor: colors.lineLightStrong }} />
            <Row>
              <TextInput
                autoFocus
                value={q}
                onChangeText={setQ}
                placeholder={forPickup ? t('pax.search.pickupPh') : t('common.whereTo')}
                placeholderTextColor={colors.stone}
                accessibilityLabel={t('common.destination')}
                returnKeyType="search"
                style={[{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.ink, paddingVertical: 4 }, { outlineStyle: 'none' } as object]}
              />
              {searching ? <ActivityIndicator size="small" color={colors.inkMuted} style={{ marginRight: 6 }} /> : null}
              {q ? <IconButton icon={X} label={t('pax.search.clear')} tone="clear" size={30} onPress={() => setQ('')} /> : null}
            </Row>
          </View>
        </Row>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r, i) => `${r.item.id}-${i}`}
        renderItem={renderPlace}
        contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: insets.bottom + 20 }}
        keyboardShouldPersistTaps="handled"
        // When the address isn't found (or the passenger prefers it): drop the pin on the map.
        ListHeaderComponent={
          <Tap
            onPress={() => {
              // No quote yet: start one at the passenger's position, then move the pin.
              if (!forPickup && (!ride || ride.phase !== 'quote')) startQuote(here);
              router.navigate(`/passenger/ride?pin=${forPickup ? 'pickup' : 'destination'}&k=${Date.now()}`);
            }}
            accessibilityLabel={t('pax.search.pickOnMap')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.lineLight }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
              <MapPinned size={18} color={colors.midnight} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt v="bodyStrong">{t('pax.search.pickOnMap')}</Txt>
              <Txt v="caption" color={colors.inkMuted}>
                {t('pax.search.pickOnMapSub')}
              </Txt>
            </View>
          </Tap>
        }
        ListEmptyComponent={
          q.trim() && !searching ? (
            <EmptyState
              icon={SearchX}
              title={t('pax.search.emptyTitle')}
              body={t('pax.search.emptyBody', { query: q, example: countryCode === 'CW' ? 'Breedestraat 12' : 'Carrera 8 #20' })}
            />
          ) : null
        }
      />
    </View>
  );
}
