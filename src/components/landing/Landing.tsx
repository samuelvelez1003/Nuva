import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { Href, Link, router } from 'expo-router';
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
import { Aurora } from '../brand/Aurora';
import { AppIcon, RouteGlyph, Wordmark } from '../brand/Brand';
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
import { offset } from '../../lib/geo';
import { fetchStreetRoute, RouteResult } from '../../lib/routing';
import { useApp } from '../../store/AppStore';
import { ANDROID_APK_URL, CUSTOMER_URL } from '../../lib/site';
import Head from 'expo-router/head';
import { SEO_LABELS, SEO_ORDER, SEO_PATHS } from '../seo/seoCopy';
import { colors, fonts, glass, radius, shadow, space } from '../../theme/tokens';

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
    <Txt v="overline" color={dark ? colors.limeOnDark : colors.limeInk} style={{ fontSize: 13, lineHeight: 16, letterSpacing: 1 }}>
      {children}
    </Txt>
  );
}

function H2({ children, dark, style }: { children: React.ReactNode; dark?: boolean; style?: object }) {
  const { wide } = useLayout();
  return (
    <Txt
      accessibilityRole="header"
      // Section titles are level 2: the hero is the page's only h1.
      {...({ 'aria-level': 2 } as object)}
      color={dark ? colors.ivory : colors.midnight}
      style={[{ fontFamily: fonts.extrabold, fontSize: wide ? 48 : 34, lineHeight: wide ? 53 : 39, letterSpacing: wide ? -1.2 : -0.8, marginTop: 14 }, style]}
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
  // Street route with live traffic (Mapbox). Until it answers only the markers show;
  // if every service fails, an explicit message with a retry — never a straight line.
  const [r, setR] = useState<RouteResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    fetchStreetRoute(CURRENT_LOCATION, HERO_DEST).then((res) => {
      if (!alive) return;
      if (res) setR(res);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  const route = r?.points;
  const { pricing } = useApp();
  const fare = r ? calculateFare(r, pricing, 'go') : null;
  const t = useT();
  const { lang } = useLanguage();
  const destName = placeName(HERO_DEST, lang);
  return (
    <View style={[{ width: 300, height: 610, borderRadius: 48, padding: 10, backgroundColor: colors.midnight, borderWidth: 1, borderColor: colors.midnight500 }, { boxShadow: '0 50px 100px -30px rgba(14,27,36,0.30), 0 30px 60px -30px rgba(14,27,36,0.40)' } as object]}>
      <View style={{ flex: 1, borderRadius: 38, overflow: 'hidden', backgroundColor: colors.ivory200 }}>
        <CityMap
          focus={route ?? [CURRENT_LOCATION, HERO_DEST]}
          minSpan={100}
          insets={{ top: 70, bottom: 230, left: 40, right: 40 }}
          route={route}
          routeStatus={r ? 'ready' : failed ? 'failed' : 'loading'}
          onRetryRoute={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
          renderMarkers={(toScreen) => (
            <>
              <UserDot pos={toScreen(CURRENT_LOCATION)} />
              <PlacePin
                pos={toScreen(HERO_DEST)}
                kind="dropoff"
                title={destName.split(' ')[0]}
                sub={r ? t('common.minutesShort', { n: r.durationMin }) : undefined}
                route={route?.map(toScreen)}
              />
              <CarMarker pos={toScreen(offset(CURRENT_LOCATION, 140, -260))} heading={0} tone="muted" size={24} />
            </>
          )}
        />
        <View style={{ position: 'absolute', top: 14, alignSelf: 'center', width: 96, height: 26, borderRadius: 14, backgroundColor: colors.midnight }} />
        <View style={[{ position: 'absolute', left: 10, right: 10, bottom: 10, backgroundColor: colors.white, borderRadius: radius.lg, padding: 14, gap: 10 }, shadow.float]}>
          <Row style={{ gap: 12 }}>
            <RouteGlyph height={40} />
            <View style={{ flex: 1 }}>
              <Txt v="caption" color={colors.inkMuted}>
                {t('web.hero.phoneCaption')}
              </Txt>
              <Txt v="title" color={colors.midnight} numberOfLines={1}>
                {destName}
              </Txt>
            </View>
          </Row>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: colors.ivory200, paddingTop: 10 }}>
            <Txt v="caption" color={colors.inkMuted} style={{ flexShrink: 1 }}>
              {fare ? t('web.hero.forDriver', { amount: cop(fare.driverEarnings) }) : failed ? t('route.failed') : t('route.calculating')}
            </Txt>
            {fare ? <Money value={cop(fare.finalFare)} size={26} color={colors.midnight} /> : null}
          </Row>
          <View style={[{ height: 44, borderRadius: radius.pill, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }, shadow.glow]}>
            <Txt v="smallStrong" color={colors.onLime}>
              {t('web.hero.requestGo')}
            </Txt>
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
  // Real street distance/time with live traffic (Mapbox). No price until it answers:
  // the calculator never prices a straight-line estimate.
  // The answer is kept with the trip it belongs to: another origin/destination (or a
  // retry) is "calculating" until its own route arrives.
  const [attempt, setAttempt] = useState(0);
  const key = `${from.id}>${to.id}#${attempt}`;
  const [res, setRes] = useState<{ key: string; r: RouteResult | null } | null>(null);
  useEffect(() => {
    let alive = true;
    fetchStreetRoute(from, to).then((r) => alive && setRes({ key, r }));
    return () => {
      alive = false;
    };
  }, [from, to, key]);
  const current = res?.key === key ? res : null;
  const metrics = current?.r ?? null;
  const failed = !!current && !current.r;
  const cats = CATEGORY_ORDER.filter((c) => pricing.categories[c].enabled);
  const quotes = metrics ? cats.map((c) => calculateFare(metrics, pricing, c)) : null;
  const go = quotes ? quotes.find((q) => q.category === 'go') ?? quotes[0] : null;
  const pending = (
    <Row style={{ gap: 10, minHeight: 44 }}>
      <Txt v="smallStrong" color={failed ? colors.limeInk : colors.inkMuted} style={{ flex: 1 }} accessibilityLiveRegion="polite">
        {failed ? t('route.failed') : t('route.calculating')}
      </Txt>
      {failed ? (
        <Button label={t('route.retry')} size="sm" full={false} variant="dark" onPress={() => setAttempt((n) => n + 1)} style={{ height: 44 }} />
      ) : null}
    </Row>
  );

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
        <View style={[{ padding: space[5], borderRadius: radius.lg, backgroundColor: colors.white, gap: 10 }, shadow.soft]}>
          <Row style={{ gap: 12 }}>
            <RouteGlyph height={44} />
            <View style={{ flex: 1 }}>
              <Txt v="small" color={colors.inkMuted}>
                {placeName(from, lang)}
              </Txt>
              <Txt v="bodyStrong">{placeName(to, lang)}</Txt>
            </View>
            {metrics ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Txt v="smallStrong" tabular>
                  {km(metrics.distanceKm)}
                </Txt>
                <Txt v="caption" color={colors.inkMuted}>
                  {minutes(metrics.durationMin)}
                </Txt>
              </View>
            ) : null}
          </Row>
          <View style={{ height: 1, backgroundColor: colors.ivory200 }} />
          {go
            ? [
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
              ))
            : pending}
          <Txt v="caption" color={colors.inkMuted}>
            {t('web.calc.example')}
          </Txt>
        </View>
      </View>

      <View style={{ flex: 1, gap: 8 }}>
        {cats.map((cat, i) => {
          const q = quotes ? quotes[i] : null;
          const c = pricing.categories[cat];
          const Icon = CAT_ICON[cat];
          const featured = cat === 'go';
          return (
            <Animated.View key={`${cat}-${from.id}-${to.id}-${q ? 'q' : 'p'}`} entering={FadeIn.delay(i * 40)}>
              <Row style={[{ gap: 14, padding: featured ? 14 : 16, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: featured ? 2 : 0, borderColor: colors.lime }, shadow.soft]}>
                <View style={{ width: 46, height: 40, borderRadius: 12, backgroundColor: featured ? colors.limeSoft : colors.ivory100, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={featured ? colors.limeInk : colors.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="title" color={colors.ink}>
                    {c.name}
                  </Txt>
                  <Txt v="caption" color={colors.inkMuted} numberOfLines={2}>
                    {c.tagline}
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {q ? (
                    <>
                      <Txt v="h3" tabular color={colors.ink}>
                        {cop(q.finalFare)}
                      </Txt>
                      <Txt v="caption" color={colors.limeInk} tabular>
                        {t('web.calc.toDriver', { amount: cop(q.driverEarnings) })}
                      </Txt>
                    </>
                  ) : (
                    <Txt v="caption" color={colors.inkMuted}>
                      {failed ? '—' : t('route.calculating')}
                    </Txt>
                  )}
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
            <Txt v="bodyStrong" color={colors.limeOnDark} tabular>
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
            <Txt v="bodyStrong" color={colors.limeOnDark} tabular>
              {days}
            </Txt>
          </Row>
          <View style={{ marginTop: 6, backgroundColor: colors.ivory, borderRadius: radius.pill, paddingHorizontal: 14 }}>
            <Slider label={t('web.driverCalc.daysPerMonth')} value={days} min={8} max={30} onChange={setDays} />
          </View>
        </View>
        <Txt v="caption" color={colors.onDarkMuted}>
          {t('web.driverCalc.avgNote', { amount: cop(avg), city: copy.cityLong })}
        </Txt>
      </View>
      <View style={{ flex: 1, padding: space[6], borderRadius: radius.xl, backgroundColor: colors.midnight700, borderWidth: 1, borderColor: colors.lineDarkStrong, gap: space[4] }}>
        <View>
          <Txt v="caption" color={colors.onDarkMuted}>
            {t('web.driverCalc.monthly')}
          </Txt>
          <Money value={cop(net)} size={48} color={colors.ivory} signColor={colors.limeOnDark} />
        </View>
        <View style={{ height: 10, borderRadius: 5, flexDirection: 'row', gap: 3, overflow: 'hidden' }}>
          <View style={{ flex: net || 1, height: 10, borderRadius: 5, backgroundColor: colors.limeOnDark }} />
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
          <Txt v="title" color={colors.onLime}>
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
  // The same questions as structured data, so search engines can show them as rich results.
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(([qKey, a]) => ({ '@type': 'Question', name: t(qKey), acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  return (
    <View style={{ marginTop: space[8] }}>
      {Platform.OS === 'web' ? React.createElement('script', { type: 'application/ld+json', dangerouslySetInnerHTML: { __html: JSON.stringify(schema) } }) : null}
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
  const navGap = mid ? 14 : 8;

  const NAV: { k: string; l: TKey }[] = [
    { k: 'how', l: 'web.nav.how' },
    { k: 'fares', l: 'web.nav.fares' },
    { k: 'drive', l: 'web.nav.drive' },
    { k: 'safety', l: 'web.nav.safety' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.ivory100 }}>
      <Head>
        <title>{t('web.meta.title')}</title>
        <meta name="description" content={t('web.meta.description', { city: copy.cityLong, commission })} />
        <link rel="canonical" href={`${CUSTOMER_URL}/`} />
        <meta property="og:url" content={`${CUSTOMER_URL}/`} />
        <meta property="og:title" content={t('web.meta.title')} />
        <meta property="og:description" content={t('web.meta.ogDescription')} />
        <meta name="twitter:title" content={t('web.meta.title')} />
        <meta name="twitter:description" content={t('web.meta.ogDescription')} />
      </Head>
      {/* Floating nav pill (Aurora): white glass, hairline border, soft shadow. */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: mid ? 18 : 10, left: 0, right: 0, zIndex: 20, paddingHorizontal: mid ? pad - 12 : 10 }}>
        <Row
          style={[
            {
              maxWidth: 1224,
              width: '100%',
              alignSelf: 'center',
              justifyContent: 'space-between',
              gap: navGap,
              paddingVertical: 6,
              paddingLeft: mid ? 20 : 14,
              paddingRight: 6,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: 'rgba(14,27,36,0.06)',
            },
            glass.light,
            { boxShadow: '0 8px 24px rgba(14,27,36,0.06)' } as object,
          ]}
        >
          <Row style={{ gap: navGap }}>
            <Tap onPress={() => scroll.current?.scrollTo({ y: 0, animated: true })} haptics={false} accessibilityLabel={t('web.nav.homeA11y')} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Wordmark height={mid ? 34 : 30} color={colors.ink} />
            </Tap>
            <LanguagePicker tone="light" compact={width < 1280} />
          </Row>
          {wide ? (
            <Row style={{ gap: width >= 1200 ? 26 : 16 }}>
              {NAV.map((n) => (
                <Tap key={n.k} onPress={() => jump(n.k)} haptics={false} style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Txt v="smallStrong" color={colors.ink} style={{ fontFamily: fonts.medium, fontSize: 14 }}>
                    {t(n.l)}
                  </Txt>
                </Tap>
              ))}
            </Row>
          ) : null}
          {mid ? (
            <Button label={t('web.nav.downloadApp')} icon={Download} size="md" variant="dark" full={false} onPress={download} style={{ height: 44 }} />
          ) : (
            <IconButton icon={Download} label={t('web.nav.download')} tone="dark" size={44} onPress={download} />
          )}
        </Row>
      </View>

      <ScrollView ref={scroll} showsVerticalScrollIndicator={false}>
        {/* Hero, over the aurora */}
        <View style={{ backgroundColor: colors.ivory100, paddingHorizontal: pad, paddingTop: wide ? 150 : 112, paddingBottom: wide ? 96 : 64, overflow: 'hidden' }}>
          <Aurora layout="web" scale={wide ? 1.25 : 0.85} />
          <View style={{ maxWidth: 1200, width: '100%', alignSelf: 'center', flexDirection: wide ? 'row' : 'column', alignItems: 'center', gap: wide ? 64 : 48 }}>
            <Animated.View entering={FadeInDown.duration(700)} style={{ flex: wide ? 1.2 : undefined, width: wide ? undefined : '100%' }}>
              <Row style={[{ gap: 8, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.85)' }]}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime }} />
                <Txt v="smallStrong" color={colors.ink}>
                  {t('web.hero.launchCO')}
                </Txt>
              </Row>
              <Txt
                accessibilityRole="header"
                color={colors.ink}
                style={{ fontFamily: fonts.bold, fontSize: wide ? 68 : mid ? 54 : 40, lineHeight: wide ? 72 : mid ? 58 : 44, letterSpacing: wide ? -2.4 : mid ? -1.8 : -1.2, marginTop: 22 }}
              >
                {t('common.tagline.city')}
                {'\n'}
                {t('common.tagline.rhythm')}
                {'\n'}
                <Txt color={colors.limeInk} style={{ fontFamily: fonts.bold, fontSize: wide ? 68 : mid ? 54 : 40, letterSpacing: wide ? -2.4 : mid ? -1.8 : -1.2 }}>
                  {t('common.tagline.price')}
                </Txt>
              </Txt>
              <Txt v="body" color={colors.inkSoft} style={{ marginTop: 24, fontSize: wide ? 18 : 16, lineHeight: wide ? 30 : 26, maxWidth: 520 }}>
                {t('web.hero.body', { city: copy.cityLong })}
              </Txt>
              <View style={{ flexDirection: mid ? 'row' : 'column', gap: 12, marginTop: 32 }}>
                <Button label={t('common.downloadAndroid')} icon={Download} full={!mid} onPress={download} />
                <Button label={t('web.drive.cta')} variant="light" full={!mid} onPress={() => router.push('/driver/onboarding' as Href)} style={shadow.soft} />
              </View>
            </Animated.View>
            <Animated.View entering={FadeIn.delay(250).duration(800)} style={{ flex: wide ? 1 : undefined, alignItems: 'center' }}>
              <HeroPhone />
            </Animated.View>
          </View>
        </View>

        {/* Proof strip */}
        <View style={{ backgroundColor: colors.ivory100, paddingHorizontal: pad, paddingVertical: wide ? 56 : 40 }}>
          <View style={{ maxWidth: 1200, width: '100%', alignSelf: 'center', flexDirection: wide ? 'row' : 'column', gap: wide ? 20 : 14 }}>
            {[
              { k: 'commission', tone: 'forest', icon: Percent, v: commission.replace(' a ', '–').replace(' %–', '–'), t: t('web.proof.commissionTitle'), d: t('web.proof.commissionBody') },
              { k: 'surprises', tone: 'coral', icon: ShieldCheck, v: '$0', t: t('web.proof.surprisesTitle'), d: t('web.proof.surprisesBody') },
              { k: 'payments', tone: 'white', icon: Wallet, v: String(copy.web.paymentNames.length), t: t('web.proof.paymentsTitle'), d: '', pills: copy.web.paymentNames },
            ].map((s, i) => {
              // Aurora: an ink card, a soft-teal card and a white card.
              const forest = s.tone === 'forest';
              const soft = s.tone === 'coral';
              const fg = forest ? colors.ivory : colors.ink;
              const muted = forest ? colors.onDarkMuted : colors.inkSoft;
              return (
                <Animated.View
                  key={s.k}
                  entering={FadeInDown.delay(i * 90).duration(500)}
                  style={[
                    { flex: wide ? 1 : undefined, backgroundColor: forest ? colors.midnight : soft ? colors.limeSoft : colors.white, borderRadius: radius.lg, padding: wide ? space[6] : space[5], gap: 14 },
                    forest ? shadow.float : shadow.soft,
                  ]}
                >
                  <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Txt style={{ fontFamily: fonts.extrabold, fontSize: wide ? 64 : 52, lineHeight: wide ? 70 : 58, letterSpacing: -1.5 }} color={forest ? colors.limeOnDark : soft ? colors.limeInk : colors.ink}>
                      {s.v}
                    </Txt>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: forest ? colors.lime : soft ? colors.white : colors.violetSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <s.icon size={20} color={forest ? colors.onLime : soft ? colors.limeInk : colors.violet} strokeWidth={2.4} />
                    </View>
                  </Row>
                  <View style={{ gap: 4 }}>
                    <Txt v="h3" color={fg}>
                      {s.t}
                    </Txt>
                    {s.pills ? (
                      <Row style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {s.pills.map((p) => (
                          <View key={p} style={{ paddingHorizontal: 10, height: 28, borderRadius: radius.pill, backgroundColor: colors.ivory100, justifyContent: 'center' }}>
                            <Txt v="caption" color={colors.midnight}>
                              {p}
                            </Txt>
                          </View>
                        ))}
                      </Row>
                    ) : (
                      <Txt v="small" color={muted}>
                        {s.d}
                      </Txt>
                    )}
                  </View>
                </Animated.View>
              );
            })}
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
              <View key={s.n} style={[{ flex: 1, padding: space[6], borderRadius: radius.lg, backgroundColor: colors.white, gap: space[4] }, shadow.soft]}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon size={22} color={colors.ivory} />
                  </View>
                  <Txt style={{ fontFamily: fonts.extrabold, fontSize: 40, letterSpacing: -1 }} color={colors.lime}>
                    {s.n}
                  </Txt>
                </Row>
                <Txt v="h2" color={colors.midnight}>
                  {s.t}
                </Txt>
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
                  <f.icon size={20} color={colors.limeOnDark} />
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
                { k: 'verified', icon: BadgeCheck, t: t('web.safety.verifiedTitle'), d: t('web.safety.verifiedBody') },
                { k: 'pin', icon: KeyRound, t: t('web.safety.pinTitle'), d: t('web.safety.pinBody') },
                { k: 'share', icon: Share2, t: t('web.safety.shareTitle'), d: t('web.safety.shareBody') },
                { k: 'sos', icon: ShieldAlert, t: t('web.safety.sosTitle'), d: copy.web.emergency },
              ].map((f) => (
                <View key={f.k} style={[{ flexGrow: 1, flexBasis: 240, padding: space[5], borderRadius: radius.lg, backgroundColor: colors.white, gap: 10 }, shadow.soft]}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: f.k === 'sos' ? colors.dangerSoft : colors.mint, alignItems: 'center', justifyContent: 'center' }}>
                    <f.icon size={20} color={f.k === 'sos' ? colors.dangerInk : colors.mintInk} />
                  </View>
                  <Txt v="title" color={colors.midnight}>
                    {f.t}
                  </Txt>
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
        <View style={{ backgroundColor: colors.ivory100, paddingHorizontal: pad, paddingVertical: 96, overflow: 'hidden' }}>
          <Aurora layout="web" scale={wide ? 1.1 : 0.8} intensity={0.85} animated={false} />
          <View style={{ maxWidth: 1200, width: '100%', alignSelf: 'center', alignItems: wide ? 'flex-start' : 'stretch', gap: space[6] }}>
            <AppIcon size={72} />
            <Txt color={colors.midnight} style={{ fontFamily: fonts.extrabold, fontSize: wide ? 64 : 40, lineHeight: wide ? 70 : 45, letterSpacing: wide ? -1.6 : -0.9, maxWidth: 820 }}>
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
                    // Internal tools (admin console, design system) are not linked from the public site.
                    { k: 'nuva', t: 'NÜVA', l: [[t('web.footer.demo'), () => router.push('/demo' as Href)], [t('web.footer.privacy'), () => router.push('/privacidad' as Href)], [t('web.footer.terms'), () => router.push('/terminos' as Href)]] },
                  ] as { k: string; t: string; l: [string, () => void][] }[]
                ).map((g) => (
                  <View key={g.k} style={{ gap: 2 }}>
                    <Txt v="overline" color={colors.onDarkMuted} style={{ marginBottom: 6 }}>
                      {g.t}
                    </Txt>
                    {g.l.map(([label, fn], j) => (
                      // ≥ 40 px tall: comfortable to tap on a phone.
                      <Tap key={j} onPress={fn} haptics={false} style={{ minHeight: 44, justifyContent: 'center' }}>
                        <Txt v="small" color={colors.onDark}>
                          {label}
                        </Txt>
                      </Tap>
                    ))}
                  </View>
                ))}
                {/* Search landing pages: real <a href> links, so crawlers follow them. */}
                <View style={{ gap: 2 }}>
                  <Txt v="overline" color={colors.onDarkMuted} style={{ marginBottom: 6 }}>
                    {copy.cityLong}
                  </Txt>
                  {SEO_ORDER.map((p) => (
                    <Link key={p} href={SEO_PATHS[p] as Href} style={{ minHeight: 44, justifyContent: 'center' }}>
                      <Txt v="small" color={colors.onDark} style={{ lineHeight: 44 }}>
                        {SEO_LABELS[p]}
                      </Txt>
                    </Link>
                  ))}
                </View>
              </Row>
            </View>
            <View style={{ height: 1, backgroundColor: colors.lineDark }} />
            <Txt v="caption" color={colors.onDarkMuted}>
              © {new Date().getFullYear()} NÜVA · {copy.web.footer}
            </Txt>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
