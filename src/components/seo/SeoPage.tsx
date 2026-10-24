import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { Href, Link, router } from 'expo-router';
import Head from 'expo-router/head';
import { ArrowRight, ArrowUpRight, Check, Download } from 'lucide-react-native';
import { BrandRings, RouteGlyph, Wordmark } from '../brand/Brand';
import { Button, IconButton } from '../ui/Button';
import { Row } from '../ui/primitives';
import { Txt } from '../ui/Txt';
import { COUNTRIES } from '../../lib/countries';
import { calculateFare, CategoryId, CATEGORY_ORDER, commissionText, type PricingConfig } from '../../lib/fare';
import { cop, decimal, km, minutes } from '../../lib/format';
import type { LatLng } from '../../lib/geo';
import { buildRoute, routeMetrics } from '../../lib/geo';
import { fetchRoute } from '../../lib/routing';
import { useNuvaSettings } from '../../lib/settings';
import { ANDROID_APK_URL, CUSTOMER_URL } from '../../lib/site';
import { useApp } from '../../store/AppStore';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { SEO_LABELS, SEO_ORDER, SEO_PAGES, SEO_PATHS, SeoPageId, SHARED } from './seoCopy';

// ─── Routes quoted on each passenger page (real places of the country config) ──

const CO = COUNTRIES.CO;
const place = (id: string): LatLng & { name: string } => (id === 'center' ? CO.center : CO.places.find((p) => p.id === id)!) as LatLng & { name: string };

const ROUTES: Record<Exclude<SeoPageId, 'drivers'>, { from: string; cats: CategoryId[]; rows: [string, string][] }> = {
  pereira: {
    from: 'center',
    cats: ['moto', 'go'],
    rows: [
      ['utp', 'Universidad Tecnológica (UTP)'],
      ['unicentro', 'Unicentro Pereira'],
      ['matecana', 'Aeropuerto Matecaña'],
      ['estadio', 'Estadio Hernán Ramírez Villegas'],
      ['dosquebradas', 'Dosquebradas · parque principal'],
      ['ukumari', 'Bioparque Ukumarí · Cerritos'],
    ],
  },
  airport: {
    from: 'matecana',
    cats: ['go', 'xl'],
    rows: [
      ['center', 'Centro · Plaza de Bolívar'],
      ['circunvalar', 'Avenida Circunvalar'],
      ['utp', 'Universidad Tecnológica (UTP)'],
      ['pinares', 'Pinares de San Martín'],
      ['dosquebradas', 'Dosquebradas · parque principal'],
      ['ukumari', 'Bioparque Ukumarí · Cerritos'],
    ],
  },
  dosquebradas: {
    from: 'dosquebradas',
    cats: ['moto', 'go'],
    rows: [
      ['center', 'Pereira · Plaza de Bolívar'],
      ['viaducto', 'Viaducto César Gaviria'],
      ['circunvalar', 'Avenida Circunvalar'],
      ['unicentro', 'Unicentro Pereira'],
      ['utp', 'Universidad Tecnológica (UTP)'],
      ['matecana', 'Aeropuerto Matecaña'],
    ],
  },
};

/**
 * Quotes are for a weekday at noon (Colombia, UTC−5): no night surcharge, airport
 * surcharge only if published, the same in the pre-rendered HTML and in the browser.
 */
const DAYTIME = new Date('2026-01-14T17:00:00Z');
const DRIVER_SAMPLE = { distanceKm: 5, durationMin: 15 };
const download = () => Linking.openURL(ANDROID_APK_URL).catch(() => undefined);
const pct = (n: number) => decimal(n, n % 1 ? 1 : 0);

/** Distance/time of each row: grid estimate first (static HTML), street route once it answers. */
function useRouteMetrics(id: SeoPageId) {
  const spec = id === 'drivers' ? null : ROUTES[id];
  const initial = useMemo(
    () => (spec ? spec.rows.map(([to]) => routeMetrics(buildRoute(place(spec.from), place(to)), 'moderado')) : []),
    [spec],
  );
  const [metrics, setMetrics] = useState(initial);
  useEffect(() => {
    if (!spec) return;
    let alive = true;
    Promise.all(spec.rows.map(([to]) => fetchRoute(place(spec.from), place(to)))).then((all) => {
      if (alive) setMetrics(all.map((r, i) => (r.source === 'street' ? { distanceKm: r.distanceKm, durationMin: r.durationMin } : initial[i])));
    });
    return () => {
      alive = false;
    };
  }, [spec, initial]);
  return metrics;
}

/** Sentences that depend on the published surcharges (never claims one that isn't published). */
function surchargeCopy(pricing: PricingConfig) {
  const s = pricing.surcharges;
  const night = s?.night?.enabled ? s.night : null;
  const airport = s?.airport?.enabled ? s.airport : null;
  const nightText = night ? `nocturno (${cop(night.amount)} entre las ${night.from} y las ${night.to})` : '';
  const airportText = airport ? `de aeropuerto (${cop(airport.pickup)} al recogerte allí, ${cop(airport.dropoff)} al dejarte)` : '';
  const surcharges =
    night && airport
      ? `Solo hay dos recargos fijos y públicos, como en el taxi: ${nightText} y ${airportText}. Los ves en el desglose antes de confirmar y van 100 % al conductor.`
      : night || airport
        ? `Solo hay un recargo fijo y público, como en el taxi: el ${nightText || airportText}. Lo ves en el desglose antes de confirmar y va 100 % al conductor.`
        : 'Los únicos recargos posibles son fijos y públicos, como en el taxi (nocturno y de aeropuerto): si aplican, los ves en el desglose antes de confirmar y van 100 % al conductor.';
  const airportRule = airport
    ? `Al recogerte en el aeropuerto se suma un recargo fijo de ${cop(airport.pickup)}, y al dejarte allí uno de ${cop(airport.dropoff)}, como en el taxi. Va 100 % al conductor y lo ves en el desglose antes de pedir.`
    : 'Si hay recargo de aeropuerto, es fijo y público, como en el taxi: lo ves en el desglose antes de pedir y va 100 % al conductor.';
  const airportTable = airport ? `Incluyen el recargo de aeropuerto de ${cop(airport.pickup)}.` : '';
  const airportDrop = airport ? `El viaje al aeropuerto incluye su recargo de ${cop(airport.dropoff)}.` : '';
  return { surcharges, airportRule, airportTable, airportDrop };
}

/**
 * Search landing page (taxi in Pereira, airport, Dosquebradas, drivers): pre-rendered
 * with real content, prices from the published fare engine, FAQ structured data and
 * links to the other pages.
 */
export function SeoPage({ id }: { id: SeoPageId }) {
  const { width } = useWindowDimensions();
  const wide = width >= 1024;
  const mid = width >= 720;
  const pad = wide ? 80 : mid ? 40 : 20;
  const { pricing } = useApp();
  const { settings } = useNuvaSettings();
  const page = SEO_PAGES[id];
  const url = `${CUSTOMER_URL}${SEO_PATHS[id]}`;
  const metrics = useRouteMetrics(id);
  const isDriver = id === 'drivers';

  // ── Live values the copy refers to ──
  const go = pricing.categories.go;
  const goMult = go?.multiplier ?? 1;
  const enabled = CATEGORY_ORDER.filter((c) => pricing.categories[c]?.enabled);
  const vars: Record<string, string> = {
    commission: commissionText(pricing),
    goName: `NÜVA ${go?.name ?? 'Go'}`,
    categories: enabled.map((c) => pricing.categories[c].name).join(', '),
    base: cop(pricing.baseFare),
    perKm: cop(Math.round(pricing.pricePerKm * goMult)),
    perMin: cop(Math.round(pricing.pricePerMinute * goMult)),
    minimum: cop(Math.max(pricing.minimumFare, go?.minimumFare ?? 0)),
    freeTrips: String(settings.freeTrips),
    tierThreshold: String(settings.tierThreshold),
    tierPct: pct(settings.tierPct),
    challengeTrips: String(settings.challengeTrips),
    challengePct: pct(settings.challengePct),
    passRule: [settings.dayPassEnabled ? `${cop(settings.dayPassPrice)} por 24 horas` : '', settings.passEnabled ? `${cop(settings.passPrice)} por 7 días` : '']
      .filter(Boolean)
      .join(' o '),
    waitFreeMin: String(settings.waitFreeMin),
    waitPerMin: cop(settings.waitPerMin),
    noShowFee: cop(settings.noShowFee),
    minTopup: cop(settings.minTopup),
    debtAllowance: cop(settings.debtAllowance),
    maxPickupKm: decimal(settings.maxPickupKm, settings.maxPickupKm % 1 ? 1 : 0),
    ...surchargeCopy(pricing),
  };

  // Price table: the page's routes in its categories (only the enabled ones).
  const spec = isDriver ? null : ROUTES[id];
  const cats = spec ? (spec.cats.filter((c) => pricing.categories[c]?.enabled).length ? spec.cats.filter((c) => pricing.categories[c]?.enabled) : enabled.slice(0, 1)) : [];
  const priceCat: CategoryId = cats.includes('go') ? 'go' : cats[0];
  const quotes = spec
    ? spec.rows.map(([to, label], i) => {
        const ctx = { pickup: place(spec.from), destination: place(to), at: DAYTIME, country: 'CO' as const };
        const prices = cats.map((c) => calculateFare(metrics[i], pricing, c, ctx).finalFare);
        return { key: to, label, m: metrics[i], prices, main: calculateFare(metrics[i], pricing, priceCat, ctx).finalFare };
      })
    : [];
  if (quotes[0]) {
    vars['ex.dest'] = quotes[0].label;
    vars['ex.km'] = km(quotes[0].m.distanceKm);
    vars['ex.min'] = minutes(quotes[0].m.durationMin);
    vars['ex.price'] = cop(quotes[0].main);
  }
  // Drivers: the same sample trip as the landing's earnings calculator.
  const sample = calculateFare(DRIVER_SAMPLE, pricing, 'go');
  vars['drv.fare'] = cop(sample.finalFare);
  vars['drv.commission'] = cop(sample.platformCommission);
  vars['drv.net'] = cop(sample.driverEarnings);
  const fill = (s: string) => s.replace(/\{([\w.]+)\}/g, (m, k: string) => vars[k] ?? m).replace(/\s+/g, ' ').trim();

  const highlights = page.highlights.filter((h) => h.when !== 'pass' || settings.passEnabled || settings.dayPassEnabled);

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: page.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: fill(f.a) } })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'NÜVA', item: `${CUSTOMER_URL}/` },
          { '@type': 'ListItem', position: 2, name: SEO_LABELS[id], item: url },
        ],
      },
    ],
  };

  // ── Layout helpers ──
  const section = (bg: string, children: React.ReactNode) => (
    <View style={{ backgroundColor: bg, paddingHorizontal: pad, paddingVertical: wide ? 96 : 64 }}>
      <View style={{ maxWidth: 1100, width: '100%', alignSelf: 'center' }}>{children}</View>
    </View>
  );
  const heading = (text: string, dark: boolean) => (
    <Txt
      accessibilityRole="header"
      {...({ 'aria-level': 2 } as object)}
      color={dark ? colors.ivory : colors.ink}
      style={{ fontFamily: fonts.extrabold, fontSize: wide ? 48 : 34, lineHeight: wide ? 52 : 38, letterSpacing: wide ? -2 : -1.3 }}
    >
      {text}
    </Txt>
  );
  const colW = mid ? 140 : 88;

  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight }}>
      <Head>
        <title>{page.title}</title>
        <meta name="description" content={page.description} />
        <link rel="canonical" href={url} />
        <meta property="og:url" content={url} />
        <meta property="og:title" content={page.title} />
        <meta property="og:description" content={page.description} />
        <meta name="twitter:title" content={page.title} />
        <meta name="twitter:description" content={page.description} />
      </Head>
      {Platform.OS === 'web' ? React.createElement('script', { type: 'application/ld+json', dangerouslySetInnerHTML: { __html: JSON.stringify(schema) } }) : null}

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Navigation */}
        <View style={{ paddingHorizontal: pad, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.lineDark }}>
          <Row style={{ maxWidth: 1100, width: '100%', alignSelf: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Link href="/" accessibilityLabel={SHARED.home}>
              <Wordmark height={24} color={colors.ivory} />
            </Link>
            {wide ? (
              <Row style={{ gap: 28 }}>
                {SEO_ORDER.filter((p) => p !== id).map((p) => (
                  <Link key={p} href={SEO_PATHS[p] as Href}>
                    <Txt v="smallStrong" color={colors.onDarkMuted}>
                      {SEO_LABELS[p]}
                    </Txt>
                  </Link>
                ))}
              </Row>
            ) : null}
            {mid ? (
              <Button label={SHARED.getApp} icon={Download} size="sm" full={false} onPress={download} />
            ) : (
              <IconButton icon={Download} label={SHARED.getApp} tone="lime" size={36} onPress={download} />
            )}
          </Row>
        </View>

        {/* Hero */}
        <View style={{ paddingHorizontal: pad, paddingTop: wide ? 110 : 64, paddingBottom: wide ? 110 : 72, overflow: 'hidden' }}>
          <View pointerEvents="none" style={{ position: 'absolute', right: wide ? -140 : -300, top: wide ? -60 : 40 }}>
            <BrandRings size={wide ? 760 : 560} />
          </View>
          <View style={{ maxWidth: 1100, width: '100%', alignSelf: 'center' }}>
            <Row style={{ gap: 8, alignSelf: 'flex-start', paddingHorizontal: 12, height: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineDarkStrong }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime }} />
              <Txt v="caption" color={colors.ivory}>
                {page.kicker}
              </Txt>
            </Row>
            <Txt
              accessibilityRole="header"
              {...({ 'aria-level': 1 } as object)}
              color={colors.ivory}
              style={{ fontFamily: fonts.extrabold, fontSize: wide ? 76 : mid ? 60 : 42, lineHeight: wide ? 78 : mid ? 62 : 45, letterSpacing: wide ? -3.4 : -1.8, marginTop: 26, maxWidth: 900 }}
            >
              {page.h1}
            </Txt>
            <Txt v="body" color={colors.onDarkMuted} style={{ fontSize: wide ? 20 : 17, lineHeight: wide ? 30 : 26, maxWidth: 640, marginTop: 24 }}>
              {fill(page.intro)}
            </Txt>
            <View style={{ flexDirection: mid ? 'row' : 'column', gap: 12, marginTop: 34 }}>
              <Button label={SHARED.getApp} icon={Download} full={!mid} onPress={download} />
              {isDriver ? (
                <Button label={SHARED.drive} iconRight={ArrowRight} variant="outlineDark" full={!mid} onPress={() => router.push('/driver/onboarding' as Href)} />
              ) : (
                <Button label={SHARED.useWeb} iconRight={ArrowRight} variant="outlineDark" full={!mid} onPress={() => router.push('/demo' as Href)} />
              )}
            </View>
          </View>
        </View>

        {/* Prices (passengers) or sample earnings (drivers) */}
        {section(
          colors.ivory100,
          <>
            {heading(page.priceTitle, false)}
            <Row style={{ gap: 12, marginTop: 28 }}>
              <RouteGlyph height={28} />
              <Txt v="bodyStrong" color={colors.inkSoft}>
                {fill(page.priceFrom)}
              </Txt>
            </Row>
            <View style={{ marginTop: 20, borderTopWidth: 1, borderColor: colors.lineLightStrong }}>
              {isDriver ? (
                [
                  { label: 'Lo que paga el pasajero', value: vars['drv.fare'], strong: false },
                  { label: `Comisión NÜVA (${pct(sample.commissionPct)} %)`, value: `−${vars['drv.commission']}`, strong: false },
                  { label: 'Te queda a ti', value: vars['drv.net'], strong: true },
                ].map(({ label, value, strong }) => (
                  <Row key={label} style={{ paddingVertical: 18, gap: 12, borderBottomWidth: 1, borderColor: colors.lineLight }}>
                    <Txt v={strong ? 'h3' : 'body'} style={{ flex: 1 }} color={colors.ink}>
                      {label}
                    </Txt>
                    <Txt v={strong ? 'h2' : 'bodyStrong'} tabular color={strong ? colors.limeInk : colors.ink}>
                      {value}
                    </Txt>
                  </Row>
                ))
              ) : (
                <>
                  <Row style={{ paddingVertical: 12, gap: 12 }}>
                    <Txt v="overline" color={colors.inkMuted} style={{ flex: 1 }}>
                      {SHARED.colRoute}
                    </Txt>
                    {cats.map((c) => (
                      <Txt key={c} v="overline" color={colors.inkMuted} style={{ width: colW, textAlign: 'right' }}>
                        {pricing.categories[c].name}
                      </Txt>
                    ))}
                  </Row>
                  {quotes.map((q) => (
                    <Row key={q.key} style={{ paddingVertical: 16, gap: 12, borderTopWidth: 1, borderColor: colors.lineLight }}>
                      <View style={{ flex: 1 }}>
                        <Txt v="title" color={colors.ink}>
                          {q.label}
                        </Txt>
                        <Txt v="caption" color={colors.inkMuted} tabular>
                          {km(q.m.distanceKm)} · {minutes(q.m.durationMin)}
                        </Txt>
                      </View>
                      {q.prices.map((p, i) => (
                        <Txt key={cats[i]} v={i === q.prices.length - 1 ? 'bodyStrong' : 'body'} tabular color={colors.ink} style={{ width: colW, textAlign: 'right' }}>
                          {cop(p)}
                        </Txt>
                      ))}
                    </Row>
                  ))}
                </>
              )}
            </View>
            <Txt v="small" color={colors.inkMuted} style={{ marginTop: 18, maxWidth: 760 }}>
              {fill(page.priceNote)}
            </Txt>
          </>,
        )}

        {/* Highlights */}
        {section(
          colors.midnight,
          <>
            {heading(page.highlightsTitle, true)}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 36, rowGap: 32 }}>
              {highlights.map((h) => (
                <View key={h.t} style={{ flexBasis: wide ? '33.33%' : mid ? '50%' : '100%', paddingRight: 28, gap: 8 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.midnight600, alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={18} color={colors.lime} />
                  </View>
                  <Txt accessibilityRole="header" {...({ 'aria-level': 3 } as object)} v="h3" color={colors.ivory}>
                    {h.t}
                  </Txt>
                  <Txt v="small" color={colors.onDarkMuted}>
                    {fill(h.b)}
                  </Txt>
                </View>
              ))}
            </View>
          </>,
        )}

        {/* Steps (+ how the fare is calculated, for passengers) */}
        {section(
          colors.ivory200,
          <>
            {heading(page.stepsTitle, false)}
            <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[4], marginTop: 32 }}>
              {page.steps.map((s, i) => (
                <View key={s.t} style={{ flex: 1, padding: space[6], borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineLight, gap: 10 }}>
                  <Txt style={{ fontFamily: fonts.extrabold, fontSize: 34, letterSpacing: -1.5 }} color={colors.ivory400}>
                    {`0${i + 1}`}
                  </Txt>
                  <Txt accessibilityRole="header" {...({ 'aria-level': 3 } as object)} v="h3">
                    {s.t}
                  </Txt>
                  <Txt v="body" color={colors.inkSoft}>
                    {s.b}
                  </Txt>
                </View>
              ))}
            </View>
            {isDriver ? null : (
              <View style={{ marginTop: 56, flexDirection: wide ? 'row' : 'column', gap: space[8] }}>
                <View style={{ flex: 1, gap: 12 }}>
                  <Txt accessibilityRole="header" {...({ 'aria-level': 3 } as object)} v="h2">
                    {SHARED.fareTitle}
                  </Txt>
                  <Txt v="body" color={colors.inkSoft} style={{ fontSize: 16, lineHeight: 25 }}>
                    {SHARED.fareBody}
                  </Txt>
                </View>
                <View style={{ flex: 1, padding: space[5], borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineLight, gap: 10 }}>
                  {(['base', 'perKm', 'perMin', 'minimum'] as const).map((k) => (
                    <Row key={k} style={{ justifyContent: 'space-between' }}>
                      <Txt v="small" color={colors.inkSoft}>
                        {SHARED.fareRows[k]}
                      </Txt>
                      <Txt v="smallStrong" tabular>
                        {vars[k]}
                      </Txt>
                    </Row>
                  ))}
                  <Txt v="caption" color={colors.inkMuted} style={{ marginTop: 4 }}>
                    {fill(SHARED.fareNote)}
                  </Txt>
                </View>
              </View>
            )}
          </>,
        )}

        {/* FAQ: every answer visible, exactly as in the structured data */}
        {section(
          colors.ivory100,
          <>
            {heading(SHARED.faqTitle, false)}
            <View style={{ marginTop: 24 }}>
              {page.faq.map((f) => (
                <View key={f.q} style={{ paddingVertical: 22, gap: 8, borderTopWidth: 1, borderColor: colors.lineLightStrong }}>
                  <Txt accessibilityRole="header" {...({ 'aria-level': 3 } as object)} v="h3">
                    {f.q}
                  </Txt>
                  <Txt v="body" color={colors.inkSoft} style={{ maxWidth: 760, fontSize: 16, lineHeight: 25 }}>
                    {fill(f.a)}
                  </Txt>
                </View>
              ))}
            </View>
          </>,
        )}

        {/* Call to action + links to the other pages */}
        <View style={{ backgroundColor: colors.lime, paddingHorizontal: pad, paddingVertical: wide ? 96 : 64 }}>
          <View style={{ maxWidth: 1100, width: '100%', alignSelf: 'center', gap: 18 }}>
            <Txt color={colors.midnight} style={{ fontFamily: fonts.extrabold, fontSize: wide ? 60 : 38, lineHeight: wide ? 62 : 41, letterSpacing: wide ? -2.6 : -1.5, maxWidth: 820 }}>
              {isDriver ? SEO_PAGES.drivers.h1 : SHARED.ctaTitle}
            </Txt>
            <Txt v="body" color={colors.midnight} style={{ maxWidth: 560, fontSize: 17, lineHeight: 26 }}>
              {isDriver ? SHARED.ctaDriverBody : SHARED.ctaBody}
            </Txt>
            <View style={{ flexDirection: mid ? 'row' : 'column', gap: 12, marginTop: 8 }}>
              <Button label={SHARED.getApp} icon={Download} variant="dark" full={!mid} onPress={download} />
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={{ paddingHorizontal: pad, paddingVertical: 48, backgroundColor: colors.midnight }}>
          <View style={{ maxWidth: 1100, width: '100%', alignSelf: 'center', gap: 28 }}>
            <Txt v="overline" color={colors.onDarkMuted}>
              {SHARED.related}
            </Txt>
            <View style={{ flexDirection: mid ? 'row' : 'column', flexWrap: 'wrap', gap: mid ? 32 : 4 }}>
              {[...SEO_ORDER.filter((p) => p !== id).map((p) => ({ href: SEO_PATHS[p], label: SEO_LABELS[p] })), { href: '/', label: SHARED.home }].map((l) => (
                <Link key={l.href} href={l.href as Href} style={{ minHeight: 40, justifyContent: 'center' }}>
                  <Row style={{ gap: 6, minHeight: 40 }}>
                    <Txt v="bodyStrong" color={colors.ivory}>
                      {l.label}
                    </Txt>
                    <ArrowUpRight size={16} color={colors.lime} />
                  </Row>
                </Link>
              ))}
            </View>
            <View style={{ height: 1, backgroundColor: colors.lineDark }} />
            <Row style={{ gap: 24, flexWrap: 'wrap' }}>
              <Txt v="caption" color={colors.onDarkMuted} style={{ flex: 1, minWidth: 220 }}>
                © {new Date().getFullYear()} NÜVA · {SHARED.footer}
              </Txt>
              <Link href="/privacidad">
                <Txt v="small" color={colors.onDark}>
                  {SHARED.privacy}
                </Txt>
              </Link>
              <Link href="/terminos">
                <Txt v="small" color={colors.onDark}>
                  {SHARED.terms}
                </Txt>
              </Link>
            </Row>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
