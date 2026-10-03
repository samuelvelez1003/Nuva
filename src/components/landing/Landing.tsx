import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, useWindowDimensions, View } from 'react-native';
import { Href, router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  ArrowRight,
  BadgeCheck,
  Bike,
  Car,
  ChevronDown,
  Download,
  Eye,
  KeyRound,
  MapPin,
  Percent,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from 'lucide-react-native';
import { AppIcon, BrandRings, RouteGlyph, Wordmark } from '../brand/Brand';
import { Flag } from '../brand/Flags';
import { Slider } from '../admin/AdminKit';
import { CityMap } from '../map/CityMap';
import { CarMarker, PlacePin, UserDot } from '../map/Markers';
import { Button, IconButton, Tap } from '../ui/Button';
import { LanguagePicker } from '../ui/LanguagePicker';
import { Chip, Row } from '../ui/primitives';
import { Money, Txt } from '../ui/Txt';
import { CURRENT_LOCATION, Place, PLACES } from '../../data/places';
import { calculateFare, CategoryId, CATEGORY_ORDER, commissionText } from '../../lib/fare';
import { useCountry } from '../../lib/country';
import { placeName, useCountryCopy } from '../../lib/countries';
import { type TKey, useLanguage, useT } from '../../i18n';
import { cop, decimal, km, minutes } from '../../lib/format';
import { buildRoute, offset, routeMetrics } from '../../lib/geo';
import { estimateRoute, fetchRoute } from '../../lib/routing';
import { useApp } from '../../store/AppStore';
import { ADMIN_URL, ANDROID_APK_URL } from '../../lib/site';
import Head from 'expo-router/head';
import { colors, fonts, radius, shadow, space } from '../../theme/tokens';

export const ANDROID_DOWNLOAD = ANDROID_APK_URL;

const CAT_ICON: Record<CategoryId, typeof Car> = { moto: Bike, go: Car, eco: Zap, confort: Sparkles, xl: Users };

// ─── Layout helpers ─────────────────────────────────────────────────────────

function useLayout() {
  const { width } = useWindowDimensions();
  return { wide: width >= 1024, mid: width >= 720, pad: width >= 1024 ? 80 : width >= 720 ? 40 : 20 };
}

function Section({ children, bg = colors.ivory100, onLayout, style }: { children: React.ReactNode; bg?: string; onLayout?: (y: number) => void; style?: object }) {
  const { pad } = useLayout();
  return (
    <View onLayout={(e) => onLayout?.(e.nativeEvent.layout.y)} style={[{ backgroundColor: bg, paddingHorizontal: pad, paddingVertical: 96 }, style]}>
      <View style={{ maxWidth: 1200, width: '100%', alignSelf: 'center' }}>{children}</View>
    </View>
  );
}

function Kicker({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <Txt v="overline" color={dark ? colors.lime : colors.inkMuted}>
      {children}
    </Txt>
  );
}

function H2({ children, dark, style }: { children: React.ReactNode; dark?: boolean; style?: object }) {
  const { wide } = useLayout();
  return (
    <Txt
      accessibilityRole="header"
      color={dark ? colors.ivory : colors.ink}
      style={[{ fontFamily: fonts.extrabold, fontSize: wide ? 52 : 36, lineHeight: wide ? 54 : 39, letterSpacing: wide ? -2.2 : -1.4, marginTop: 14 }, style]}
    >
      {children}
    </Txt>
  );
}

// ─── Hero phone: the real map component, framed ────────────────────────────

function HeroPhone() {
  const { country } = useCountry();
  // The country's showcase trip: centre → a well-known destination (street route once OSRM answers).
  const HERO_DEST = PLACES.find((p) => p.id === country.web.heroDest) ?? PLACES[0];
  const [r, setR] = useState(() => estimateRoute(CURRENT_LOCATION, HERO_DEST));
  useEffect(() => {
    fetchRoute(CURRENT_LOCATION, HERO_DEST).then(setR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const route = r.points;
  const { pricing } = useApp();
  const fare = calculateFare(r, pricing, 'go');
  const t = useT();
  const { lang } = useLanguage();
  const destName = placeName(HERO_DEST, lang);
  return (
    <View style={[{ width: 300, height: 610, borderRadius: 48, padding: 10, backgroundColor: '#050605', borderWidth: 1, borderColor: '#2A302B' }, { boxShadow: '0 60px 120px -30px rgba(212,255,95,0.25), 0 40px 80px -30px rgba(0,0,0,0.7)' } as object]}>
      <View style={{ flex: 1, borderRadius: 38, overflow: 'hidden', backgroundColor: colors.ivory200 }}>
        <CityMap
          focus={route}
          minSpan={100}
          insets={{ top: 70, bottom: 230, left: 40, right: 40 }}
          route={route}
          renderMarkers={(toScreen) => (
            <>
              <UserDot pos={toScreen(CURRENT_LOCATION)} />
              <PlacePin pos={toScreen(HERO_DEST)} kind="dropoff" title={destName.split(' ')[0]} sub={t('common.minutesShort', { n: r.durationMin })} />
              <CarMarker pos={toScreen(offset(CURRENT_LOCATION, 140, -260))} heading={0} tone="muted" size={24} />
            </>
          )}
        />
        <View style={{ position: 'absolute', top: 14, alignSelf: 'center', width: 96, height: 26, borderRadius: 14, backgroundColor: '#000' }} />
        <View style={[{ position: 'absolute', left: 10, right: 10, bottom: 10, backgroundColor: colors.white, borderRadius: 26, padding: 14, gap: 10 }, shadow.float]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Txt v="caption" color={colors.inkMuted}>
                {t('web.hero.phoneCaption')}
              </Txt>
              <Txt v="title">{destName}</Txt>
            </View>
          </Row>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <Txt v="caption" color={colors.inkMuted}>
              {t('web.hero.forDriver', { amount: cop(fare.driverEarnings) })}
            </Txt>
            <Money value={cop(fare.finalFare)} size={26} />
          </Row>
          <View style={{ height: 44, borderRadius: radius.pill, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="smallStrong">{t('web.hero.requestGo')}</Txt>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Fare calculator (live pricing, same engine as the app & server) ───────

function FareCalculator() {
  const { wide } = useLayout();
  const { pricing } = useApp();
  const { country } = useCountry();
  const copy = useCountryCopy(country.code);
  const t = useT();
  const { lang } = useLanguage();
  const byId = (id: string) => (id === 'current' ? CURRENT_LOCATION : PLACES.find((p) => p.id === id));
  const ORIGINS = country.web.calcOrigins.map(byId).filter(Boolean) as Place[];
  const DESTS = country.web.calcDests.map(byId).filter(Boolean) as Place[];
  const [from, setFrom] = useState(ORIGINS[0]);
  const [to, setTo] = useState(DESTS[1] ?? DESTS[0]);
  // Real street distance/time (OSRM), estimate meanwhile.
  const [metrics, setMetrics] = useState(() => estimateRoute(from, to));
  useEffect(() => {
    let alive = true;
    setMetrics(estimateRoute(from, to));
    fetchRoute(from, to).then((r) => alive && setMetrics(r));
    return () => {
      alive = false;
    };
  }, [from, to]);
  const quotes = CATEGORY_ORDER.filter((c) => pricing.categories[c].enabled).map((c) => calculateFare(metrics, pricing, c));
  const go = quotes.find((q) => q.category === 'go') ?? quotes[0];

  return (
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[8] }}>
      <View style={{ flex: 1, gap: space[5] }}>
        <View>
          <Txt v="smallStrong" color={colors.inkMuted} style={{ marginBottom: 10 }}>
            {t('web.calc.from')}
          </Txt>
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            {ORIGINS.map((p) => (
              <Chip key={p.id} label={placeName(p, lang)} icon={MapPin} active={from.id === p.id} onPress={() => setFrom(p)} />
            ))}
          </Row>
        </View>
        <View>
          <Txt v="smallStrong" color={colors.inkMuted} style={{ marginBottom: 10 }}>
            {t('web.calc.to')}
          </Txt>
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            {DESTS.map((p) => (
              <Chip key={p.id} label={placeName(p, lang).replace('Centro Comercial ', '')} active={to.id === p.id} onPress={() => setTo(p)} />
            ))}
          </Row>
        </View>
        <View style={{ padding: space[5], borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineLight, gap: 10 }}>
          <Row style={{ gap: 12 }}>
            <RouteGlyph height={44} />
            <View style={{ flex: 1 }}>
              <Txt v="small" color={colors.inkMuted}>
                {placeName(from, lang)}
              </Txt>
              <Txt v="bodyStrong">{placeName(to, lang)}</Txt>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Txt v="smallStrong" tabular>
                {km(metrics.distanceKm)}
              </Txt>
              <Txt v="caption" color={colors.inkMuted}>
                {minutes(metrics.durationMin)}
              </Txt>
            </View>
          </Row>
          <View style={{ height: 1, backgroundColor: colors.lineLight }} />
          {[
            [t('web.calc.baseFare'), cop(go.baseFare)],
            [`${km(go.distanceKm)} × ${cop(pricing.pricePerKm)}`, cop(go.distanceCharge)],
            [`${minutes(go.durationMin)} × ${cop(pricing.pricePerMinute)}`, cop(go.timeCharge)],
          ].map(([l, v]) => (
            <Row key={l} style={{ justifyContent: 'space-between' }}>
              <Txt v="small" color={colors.inkSoft}>
                {l}
              </Txt>
              <Txt v="smallStrong" tabular>
                {v}
              </Txt>
            </Row>
          ))}
          <Txt v="caption" color={colors.inkMuted}>
            {t('web.calc.example')}
          </Txt>
        </View>
      </View>

      <View style={{ flex: 1, gap: 8 }}>
        {quotes.map((q, i) => {
          const c = pricing.categories[q.category];
          const Icon = CAT_ICON[q.category];
          const featured = q.category === 'go';
          return (
            <Animated.View key={`${q.category}-${from.id}-${to.id}`} entering={FadeIn.delay(i * 40)}>
              <Row style={{ gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: featured ? colors.midnight : colors.white, borderWidth: featured ? 0 : 1, borderColor: colors.lineLight }}>
                <View style={{ width: 46, height: 40, borderRadius: 12, backgroundColor: featured ? colors.lime : colors.ivory100, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={colors.midnight} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="title" color={featured ? colors.ivory : colors.ink}>
                    {c.name}
                  </Txt>
                  <Txt v="caption" color={featured ? colors.onDarkMuted : colors.inkMuted} numberOfLines={1}>
                    {c.tagline}
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt v="h3" tabular color={featured ? colors.ivory : colors.ink}>
                    {cop(q.finalFare)}
                  </Txt>
                  <Txt v="caption" color={featured ? colors.lime : colors.limeInk} tabular>
                    {t('web.calc.toDriver', { amount: cop(q.driverEarnings) })}
                  </Txt>
                </View>
              </Row>
            </Animated.View>
          );
        })}
        <Txt v="caption" color={colors.inkMuted} style={{ marginTop: 6 }}>
          {copy.web.currencyNote} {t('web.calc.priceNote')}
        </Txt>
      </View>
    </View>
  );
}

// ─── Driver earnings calculator ────────────────────────────────────────────

function DriverCalculator() {
  const { wide } = useLayout();
  const { pricing } = useApp();
  const { country } = useCountry();
  const copy = useCountryCopy(country.code);
  const t = useT();
  const [trips, setTrips] = useState(14);
  const [days, setDays] = useState(22);
  // Same engine and same commission the driver sees in the app (NÜVA Go, 5 km · 15 min).
  const sample = useMemo(() => calculateFare({ distanceKm: 5, durationMin: 15 }, pricing, 'go'), [pricing]);
  const avg = sample.finalFare;
  const n = trips * days;
  const gross = avg * n;
  const commission = sample.platformCommission * n;
  const net = sample.driverEarnings * n;
  const keepPct = 100 - sample.commissionPct;

  return (
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[8], marginTop: space[10] }}>
      <View style={{ flex: 1, gap: space[5] }}>
        <View>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="bodyStrong" color={colors.ivory}>
              {t('web.driverCalc.tripsPerDay')}
            </Txt>
            <Txt v="bodyStrong" color={colors.lime} tabular>
              {trips}
            </Txt>
          </Row>
          <View style={{ marginTop: 6, backgroundColor: colors.ivory, borderRadius: radius.pill, paddingHorizontal: 14 }}>
            <Slider label={t('web.driverCalc.tripsPerDay')} value={trips} min={4} max={30} onChange={setTrips} />
          </View>
        </View>
        <View>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="bodyStrong" color={colors.ivory}>
              {t('web.driverCalc.daysPerMonth')}
            </Txt>
            <Txt v="bodyStrong" color={colors.lime} tabular>
              {days}
            </Txt>
          </Row>
          <View style={{ marginTop: 6, backgroundColor: colors.ivory, borderRadius: radius.pill, paddingHorizontal: 14 }}>
            <Slider label={t('web.driverCalc.daysPerMonth')} value={days} min={8} max={30} onChange={setDays} />
          </View>
        </View>
        <Txt v="caption" color={colors.onDarkFaint}>
          {t('web.driverCalc.avgNote', { amount: cop(avg), city: copy.cityLong })}
        </Txt>
      </View>
      <View style={{ flex: 1, padding: space[6], borderRadius: radius.xl, backgroundColor: colors.midnight700, borderWidth: 1, borderColor: colors.lineDarkStrong, gap: space[4] }}>
        <View>
          <Txt v="caption" color={colors.onDarkMuted}>
            {t('web.driverCalc.monthly')}
          </Txt>
          <Money value={cop(net)} size={48} color={colors.ivory} signColor={colors.lime} />
        </View>
        <View style={{ height: 10, borderRadius: 5, flexDirection: 'row', gap: 3, overflow: 'hidden' }}>
          <View style={{ flex: net || 1, height: 10, borderRadius: 5, backgroundColor: colors.lime }} />
          <View style={{ flex: commission || 0.01, height: 10, borderRadius: 5, backgroundColor: colors.midnight400 }} />
        </View>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="small" color={colors.onDarkMuted}>
            {t('common.chargedToPassengers')}
          </Txt>
          <Txt v="smallStrong" color={colors.onDarkMuted} tabular>
            {cop(gross)}
          </Txt>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="small" color={colors.onDarkMuted}>
            {t('common.nuvaCommissionPct', { pct: decimal(sample.commissionPct, sample.commissionPct % 1 ? 1 : 0) })}
          </Txt>
          <Txt v="smallStrong" color={colors.onDarkMuted} tabular>
            −{cop(commission)}
          </Txt>
        </Row>
        <View style={{ padding: 14, borderRadius: radius.md, backgroundColor: colors.lime }}>
          <Txt v="title" color={colors.midnight}>
            {t('web.driverCalc.keep', { pct: decimal(keepPct, keepPct % 1 ? 1 : 0) })}
          </Txt>
        </View>
      </View>
    </View>
  );
}

// ─── FAQ ───────────────────────────────────────────────────────────────────

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const { pricing } = useApp();
  const { country } = useCountry();
  const copy = useCountryCopy(country.code);
  const t = useT();
  // The commission answer is filled in with the live value; the last three come from the country.
  const commission = commissionText(pricing);
  const FAQ: [TKey, string][] = [
    ['web.faq.priceQ', t('web.faq.priceA')],
    ['web.faq.surgeQ', t('web.faq.surgeA')],
    ['web.faq.commissionQ', t('web.faq.commissionA', { commission })],
    ['web.faq.payQ', copy.web.payFaq],
    ['web.faq.citiesQ', copy.web.citiesFaq],
    ['web.faq.driverQ', copy.web.driverFaq],
  ];
  return (
    <View style={{ marginTop: space[8] }}>
      {FAQ.map(([qKey, a], i) => {
        const q = t(qKey);
        const expanded = open === i;
        return (
          <View key={qKey} style={{ borderTopWidth: 1, borderTopColor: colors.lineLightStrong }}>
            <Tap onPress={() => setOpen(expanded ? null : i)} scaleTo={0.995} accessibilityState={{ expanded }} haptics={false}>
              <Row style={{ paddingVertical: 22, gap: 16 }}>
                <Txt v="h3" style={{ flex: 1 }}>
                  {q}
                </Txt>
                <ChevronDown size={22} color={colors.ink} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
              </Row>
            </Tap>
            {expanded ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <Txt v="body" color={colors.inkSoft} style={{ paddingBottom: 24, maxWidth: 760, fontSize: 16, lineHeight: 25 }}>
                  {a}
                </Txt>
              </Animated.View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function Landing() {
  const { wide, mid, pad } = useLayout();
  const { width } = useWindowDimensions();
  const t = useT();
  const scroll = useRef<ScrollView>(null);
  const anchors = useRef<Record<string, number>>({});
  const jump = (k: string) => scroll.current?.scrollTo({ y: Math.max(0, (anchors.current[k] ?? 0) - 70), animated: true });
  const download = () => Linking.openURL(ANDROID_DOWNLOAD);
  // Every public mention of the commission reads the published pricing.
  const { pricing } = useApp();
  const { country } = useCountry();
  const copy = useCountryCopy(country.code);
  const commission = commissionText(pricing);
  // Nav room: the country name hides on phones and on small desktops (where the section links show).
  const showCountryName = mid && (!wide || width >= 1280);
  const navGap = mid ? 14 : 8;

  const NAV: { k: string; l: TKey }[] = [
    { k: 'how', l: 'web.nav.how' },
    { k: 'fares', l: 'web.nav.fares' },
    { k: 'drive', l: 'web.nav.drive' },
    { k: 'safety', l: 'web.nav.safety' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight }}>
      <Head>
        <title>{t('web.meta.title')}</title>
        <meta name="description" content={t('web.meta.description', { city: copy.cityLong, commission })} />
        <meta property="og:title" content={t('web.meta.title')} />
        <meta property="og:description" content={t('web.meta.ogDescription')} />
      </Head>
      {/* Sticky nav */}
      <View style={[{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: pad, paddingVertical: 14 }, { backgroundColor: 'rgba(16,20,17,0.82)', backdropFilter: 'blur(16px)' } as object]}>
        <Row style={{ maxWidth: 1200, width: '100%', alignSelf: 'center', justifyContent: 'space-between', gap: navGap }}>
          <Row style={{ gap: navGap }}>
            <Tap onPress={() => scroll.current?.scrollTo({ y: 0, animated: true })} haptics={false} accessibilityLabel={t('web.nav.homeA11y')}>
              <Wordmark height={24} color={colors.ivory} />
            </Tap>
            {/* Country switch: back to the split homepage. */}
            <Tap onPress={() => router.navigate('/')} haptics={false} accessibilityLabel={t('web.nav.countryA11y', { country: copy.name })}>
              <Row style={{ gap: 8, height: 32, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineDarkStrong }}>
                <View style={{ borderRadius: 3, overflow: 'hidden' }}>
                  <Flag code={country.code} width={22} radius={2} />
                </View>
                {showCountryName ? (
                  <Txt v="smallStrong" color={colors.ivory}>
                    {copy.name}
                  </Txt>
                ) : null}
                <ChevronDown size={14} color={colors.onDarkMuted} />
              </Row>
            </Tap>
            <LanguagePicker tone="dark" compact={width < 1280} />
          </Row>
          {wide ? (
            <Row style={{ gap: width >= 1200 ? 32 : 20 }}>
              {NAV.map((n) => (
                <Tap key={n.k} onPress={() => jump(n.k)} haptics={false}>
                  <Txt v="smallStrong" color={colors.onDarkMuted}>
                    {t(n.l)}
                  </Txt>
                </Tap>
              ))}
            </Row>
          ) : null}
          {mid ? (
            <Button label={t('web.nav.downloadApp')} icon={Download} size="sm" full={false} onPress={download} />
          ) : (
            <IconButton icon={Download} label={t('web.nav.download')} tone="lime" size={36} onPress={download} />
          )}
        </Row>
      </View>

      <ScrollView ref={scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={{ backgroundColor: colors.midnight, paddingHorizontal: pad, paddingTop: wide ? 160 : 120, paddingBottom: wide ? 120 : 80, overflow: 'hidden' }}>
          <View pointerEvents="none" style={{ position: 'absolute', right: wide ? -120 : -260, top: 40, opacity: 0.9 }}>
            <BrandRings size={wide ? 820 : 620} />
          </View>
          <View style={{ maxWidth: 1200, width: '100%', alignSelf: 'center', flexDirection: wide ? 'row' : 'column', alignItems: 'center', gap: 64 }}>
            <Animated.View entering={FadeInDown.duration(700)} style={{ flex: wide ? 1.2 : undefined, width: wide ? undefined : '100%' }}>
              <Row style={{ gap: 8, alignSelf: 'flex-start', paddingHorizontal: 12, height: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineDarkStrong }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime }} />
                <Txt v="caption" color={colors.ivory}>
                  {t(country.code === 'CO' ? 'web.hero.launchCO' : 'web.hero.launchCW')}
                </Txt>
              </Row>
              <Txt
                accessibilityRole="header"
                color={colors.ivory}
                style={{ fontFamily: fonts.extrabold, fontSize: wide ? 96 : mid ? 72 : 52, lineHeight: wide ? 94 : mid ? 72 : 53, letterSpacing: wide ? -4.5 : -2.4, marginTop: 28 }}
              >
                {t('common.tagline.city')}
                {'\n'}
                {t('common.tagline.rhythm')}
                {'\n'}
                <Txt color={colors.lime} style={{ fontFamily: fonts.extrabold, fontSize: wide ? 96 : mid ? 72 : 52, letterSpacing: wide ? -4.5 : -2.4 }}>
                  {t('common.tagline.price')}
                </Txt>
              </Txt>
              <Txt v="body" color={colors.onDarkMuted} style={{ marginTop: 28, fontSize: wide ? 20 : 17, lineHeight: wide ? 30 : 26, maxWidth: 540 }}>
                {t('web.hero.body', { city: copy.cityLong })}
              </Txt>
              <View style={{ flexDirection: mid ? 'row' : 'column', gap: 12, marginTop: 36 }}>
                <Button label={t('common.downloadAndroid')} icon={Download} full={!mid} onPress={download} />
              </View>
              <Txt v="caption" color={colors.onDarkFaint} style={{ marginTop: 16 }}>
                {t('web.hero.iphoneSoon')}
              </Txt>
            </Animated.View>
            <Animated.View entering={FadeIn.delay(250).duration(800)} style={{ flex: wide ? 1 : undefined, alignItems: 'center' }}>
              <HeroPhone />
            </Animated.View>
          </View>
        </View>

        {/* Proof strip */}
        <View style={{ backgroundColor: colors.lime, paddingHorizontal: pad, paddingVertical: wide ? 56 : 40 }}>
          <View style={{ maxWidth: 1200, width: '100%', alignSelf: 'center', flexDirection: wide ? 'row' : 'column', gap: wide ? 20 : 14 }}>
            {[
              { k: 'commission', icon: Percent, v: commission.replace(' a ', '–').replace(' %–', '–'), t: t('web.proof.commissionTitle'), d: t('web.proof.commissionBody') },
              { k: 'surprises', icon: ShieldCheck, v: '$0', t: t('web.proof.surprisesTitle'), d: t('web.proof.surprisesBody') },
              { k: 'payments', icon: Wallet, v: String(copy.web.paymentNames.length), t: t('web.proof.paymentsTitle'), d: '', pills: copy.web.paymentNames },
            ].map((s, i) => (
              <Animated.View
                key={s.k}
                entering={FadeInDown.delay(i * 90).duration(500)}
                style={{ flex: wide ? 1 : undefined, backgroundColor: colors.midnight, borderRadius: radius.xl, padding: wide ? space[6] : space[5], gap: 14 }}
              >
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Txt style={{ fontFamily: fonts.extrabold, fontSize: wide ? 72 : 56, lineHeight: wide ? 76 : 60, letterSpacing: -3 }} color={colors.lime}>
                    {s.v}
                  </Txt>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon size={20} color={colors.midnight} strokeWidth={2.4} />
                  </View>
                </Row>
                <View style={{ gap: 4 }}>
                  <Txt v="h3" color={colors.ivory}>
                    {s.t}
                  </Txt>
                  {s.pills ? (
                    <Row style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {s.pills.map((p) => (
                        <View key={p} style={{ paddingHorizontal: 10, height: 28, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineDarkStrong, justifyContent: 'center' }}>
                          <Txt v="caption" color={colors.onDark}>
                            {p}
                          </Txt>
                        </View>
                      ))}
                    </Row>
                  ) : (
                    <Txt v="small" color={colors.onDarkMuted}>
                      {s.d}
                    </Txt>
                  )}
                </View>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* How it works */}
        <Section onLayout={(y) => (anchors.current.how = y)}>
          <Kicker>{t('web.nav.how')}</Kicker>
          <H2>{t('web.how.title')}</H2>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[5], marginTop: space[10] }}>
            {[
              { n: '01', icon: Search, t: t('common.whereTo'), d: t('web.how.step1Body') },
              { n: '02', icon: Eye, t: t('web.how.step2Title'), d: t('web.how.step2Body') },
              { n: '03', icon: Car, t: t('web.how.step3Title'), d: t('web.how.step3Body') },
            ].map((s) => (
              <View key={s.n} style={{ flex: 1, padding: space[6], borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineLight, gap: space[4] }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon size={22} color={colors.lime} />
                  </View>
                  <Txt style={{ fontFamily: fonts.extrabold, fontSize: 40, letterSpacing: -2 }} color={colors.ivory300}>
                    {s.n}
                  </Txt>
                </Row>
                <Txt v="h2">{s.t}</Txt>
                <Txt v="body" color={colors.inkSoft} style={{ fontSize: 16, lineHeight: 24 }}>
                  {s.d}
                </Txt>
              </View>
            ))}
          </View>
        </Section>

        {/* Fares */}
        <Section bg={colors.ivory200} onLayout={(y) => (anchors.current.fares = y)}>
          <Kicker>{t('web.fares.kicker')}</Kicker>
          <H2>{t('web.fares.title')}</H2>
          <Txt v="body" color={colors.inkSoft} style={{ marginTop: 16, fontSize: 18, lineHeight: 27, maxWidth: 640 }}>
            {t('web.fares.body')}
          </Txt>
          <View style={{ marginTop: space[10] }}>
            <FareCalculator />
          </View>
        </Section>

        {/* Drivers */}
        <Section bg={colors.midnight} onLayout={(y) => (anchors.current.drive = y)}>
          <Kicker dark>{t('web.drive.kicker')}</Kicker>
          <H2 dark>{t('web.drive.title')}</H2>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[5], marginTop: space[8] }}>
            {[
              { k: 'commission', icon: Percent, t: t('common.fixedCommission', { commission }), d: t('web.drive.commissionBody') },
              { k: 'net', icon: Eye, t: t('web.drive.netTitle'), d: t('web.drive.netBody') },
              { k: 'paid', icon: Wallet, t: t('web.drive.paidTitle'), d: t('web.drive.paidBody', { methods: copy.web.paymentNames.join(', ') }) },
            ].map((f) => (
              <Row key={f.k} style={{ flexGrow: 1, flexBasis: 280, gap: 14, alignItems: 'flex-start' }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.midnight600, alignItems: 'center', justifyContent: 'center' }}>
                  <f.icon size={20} color={colors.lime} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="title" color={colors.ivory}>
                    {f.t}
                  </Txt>
                  <Txt v="small" color={colors.onDarkMuted}>
                    {f.d}
                  </Txt>
                </View>
              </Row>
            ))}
          </View>
          <DriverCalculator />
          <View style={{ flexDirection: mid ? 'row' : 'column', gap: 12, marginTop: space[8] }}>
            <Button label={t('web.drive.cta')} iconRight={ArrowRight} full={!mid} onPress={() => router.push('/driver/onboarding' as Href)} />
            <Button label={t('web.drive.download')} icon={Download} variant="outlineDark" full={!mid} onPress={download} />
          </View>
        </Section>

        {/* Safety */}
        <Section onLayout={(y) => (anchors.current.safety = y)}>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[10] }}>
            <View style={{ flex: 1 }}>
              <Kicker>{t('web.nav.safety')}</Kicker>
              <H2>{t('web.safety.title')}</H2>
              <Txt v="body" color={colors.inkSoft} style={{ marginTop: 16, fontSize: 18, lineHeight: 27 }}>
                {t('web.safety.body')}
              </Txt>
            </View>
            <View style={{ flex: 1.2, flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
              {[
                { k: 'verified', icon: BadgeCheck, t: t('web.safety.verifiedTitle'), d: t(country.code === 'CW' ? 'web.safety.verifiedBodyCW' : 'web.safety.verifiedBody') },
                { k: 'pin', icon: KeyRound, t: t('web.safety.pinTitle'), d: t('web.safety.pinBody') },
                { k: 'share', icon: Share2, t: t('web.safety.shareTitle'), d: t('web.safety.shareBody') },
                { k: 'sos', icon: ShieldAlert, t: t('web.safety.sosTitle'), d: copy.web.emergency },
              ].map((f) => (
                <View key={f.k} style={{ flexGrow: 1, flexBasis: 240, padding: space[5], borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineLight, gap: 10 }}>
                  <f.icon size={22} color={colors.ink} />
                  <Txt v="title">{f.t}</Txt>
                  <Txt v="small" color={colors.inkMuted}>
                    {f.d}
                  </Txt>
                </View>
              ))}
            </View>
          </View>
        </Section>

        {/* FAQ */}
        <Section bg={colors.ivory200}>
          <Kicker>{t('web.faq.kicker')}</Kicker>
          <H2>{t('web.faq.title')}</H2>
          <Faq />
        </Section>

        {/* Final CTA */}
        <View style={{ backgroundColor: colors.lime, paddingHorizontal: pad, paddingVertical: 96, overflow: 'hidden' }}>
          <View style={{ maxWidth: 1200, width: '100%', alignSelf: 'center', alignItems: wide ? 'flex-start' : 'stretch', gap: space[6] }}>
            <AppIcon size={72} />
            <Txt color={colors.midnight} style={{ fontFamily: fonts.extrabold, fontSize: wide ? 72 : 44, lineHeight: wide ? 72 : 46, letterSpacing: wide ? -3 : -1.8, maxWidth: 820 }}>
              {t('web.cta.title')}
            </Txt>
            <View style={{ flexDirection: mid ? 'row' : 'column', gap: 12 }}>
              <Button label={t('common.downloadAndroid')} icon={Download} variant="dark" full={!mid} onPress={download} />
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={{ backgroundColor: colors.midnight, paddingHorizontal: pad, paddingVertical: 56 }}>
          <View style={{ maxWidth: 1200, width: '100%', alignSelf: 'center', gap: space[8] }}>
            <View style={{ flexDirection: mid ? 'row' : 'column', justifyContent: 'space-between', gap: space[8] }}>
              <View style={{ gap: 14, maxWidth: 340 }}>
                <Wordmark height={28} color={colors.ivory} />
                <Txt v="small" color={colors.onDarkMuted}>
                  {t('web.footer.tagline')}
                </Txt>
              </View>
              <Row style={{ gap: 56, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {(
                  [
                    { k: 'ride', t: t('web.footer.ride'), l: [[t('web.nav.how'), () => jump('how')], [t('web.nav.fares'), () => jump('fares')], [t('web.nav.safety'), () => jump('safety')]] },
                    { k: 'drive', t: t('web.footer.drive'), l: [[t('web.footer.requirements'), () => router.push('/driver/onboarding' as Href)], [t('web.footer.earnings'), () => jump('drive')]] },
                    { k: 'nuva', t: 'NÜVA', l: [[t('web.footer.demo'), () => router.push('/demo' as Href)], [t('web.footer.designSystem'), () => router.push('/design' as Href)], [t('web.footer.admin'), () => Linking.openURL(ADMIN_URL)], [t('web.footer.privacy'), () => router.push('/privacidad' as Href)], [t('web.footer.terms'), () => router.push('/terminos' as Href)]] },
                  ] as { k: string; t: string; l: [string, () => void][] }[]
                ).map((g) => (
                  <View key={g.k} style={{ gap: 10 }}>
                    <Txt v="overline" color={colors.onDarkFaint}>
                      {g.t}
                    </Txt>
                    {g.l.map(([label, fn], j) => (
                      <Tap key={j} onPress={fn} haptics={false}>
                        <Txt v="small" color={colors.onDark}>
                          {label}
                        </Txt>
                      </Tap>
                    ))}
                  </View>
                ))}
              </Row>
            </View>
            <View style={{ height: 1, backgroundColor: colors.lineDark }} />
            <Txt v="caption" color={colors.onDarkFaint}>
              © {new Date().getFullYear()} NÜVA · {copy.web.footer}
            </Txt>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
