import React, { useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Leaf, ShieldCheck, Star } from 'lucide-react-native';
import { RouteGlyph, Wordmark } from '../../components/brand/Brand';
import { Button, Tap } from '../../components/ui/Button';
import { LanguagePicker } from '../../components/ui/LanguagePicker';
import { Avatar, Row } from '../../components/ui/primitives';
import { useStatusTone } from '../../components/ui/Screen';
import { Money, Txt } from '../../components/ui/Txt';
import { CURRENT_LOCATION, PLACES } from '../../data/places';
import { useT } from '../../i18n';
import { calculateFare } from '../../lib/fare';
import { buildRoute, routeMetrics } from '../../lib/geo';
import { cop } from '../../lib/format';
import { useApp } from '../../store/AppStore';
import { useCountry } from '../../lib/country';
import { colors, fonts, radius, shadow, space } from '../../theme/tokens';

function PriceArt() {
  const { pricing } = useApp();
  const { country } = useCountry();
  const t = useT();
  const to = PLACES.find((p) => p.id === country.web.heroDest) ?? PLACES[0];
  const fare = calculateFare(routeMetrics(buildRoute(CURRENT_LOCATION, to)), pricing, 'go');
  return (
    <View style={{ gap: 12 }}>
      <View style={[{ backgroundColor: colors.white, borderRadius: radius.xl, padding: 20, transform: [{ rotate: '-3deg' }] }, shadow.float]}>
        <Row style={{ gap: 12 }}>
          <RouteGlyph height={40} />
          <View style={{ flex: 1 }}>
            <Txt v="caption" color={colors.inkMuted}>
              {CURRENT_LOCATION.name} → {to.name.split(' ')[0]}
            </Txt>
            <Txt v="bodyStrong">{to.name}</Txt>
          </View>
        </Row>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18 }}>
          <Txt v="overline" color={colors.inkMuted}>
            {t('pax.onb.closedPrice')}
          </Txt>
          <Money value={cop(fare.finalFare)} size={34} />
        </Row>
      </View>
      <Row style={[{ alignSelf: 'flex-end', backgroundColor: colors.midnight, borderRadius: radius.pill, paddingHorizontal: 14, height: 40, gap: 8, transform: [{ rotate: '2deg' }] }, shadow.soft]}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime }} />
        <Txt v="smallStrong" color={colors.ivory}>
          {t('pax.onb.forDriver', { amount: cop(fare.driverEarnings) })}
        </Txt>
      </Row>
    </View>
  );
}

function SafetyArt() {
  const t = useT();
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 180, height: 180, borderRadius: 90, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
        <ShieldCheck size={84} color={colors.midnight} strokeWidth={1.6} />
      </View>
      <Row style={[{ marginTop: -26, backgroundColor: colors.white, borderRadius: radius.pill, padding: 6, paddingRight: 16, gap: 10 }, shadow.float]}>
        <Avatar initials="LO" size={36} bg="#E5D3B8" />
        <View>
          <Txt v="smallStrong">{t('pax.onb.verified', { name: 'Luisa' })}</Txt>
          <Row style={{ gap: 4 }}>
            <Star size={11} color={colors.ink} fill={colors.ink} />
            <Txt v="caption">4,98 · PIN 4821</Txt>
          </Row>
        </View>
      </Row>
    </View>
  );
}

function RhythmArt() {
  const t = useT();
  return (
    <View style={{ gap: 10 }}>
      {[
        { id: 'moto', t: 'Moto', s: '2 min', w: '62%' as const, a: false },
        { id: 'go', t: 'Go', s: '3 min', w: '86%' as const, a: true },
        { id: 'eco', t: t('pax.onb.electric'), s: '0 CO₂', w: '74%' as const, a: false },
      ].map((r) => (
        <Row key={r.id} style={[{ width: r.w, alignSelf: r.a ? 'flex-end' : 'flex-start', backgroundColor: r.a ? colors.lime : colors.midnight600, borderRadius: radius.lg, padding: 18, justifyContent: 'space-between' }]}>
          <Txt v="title" color={r.a ? colors.midnight : colors.ivory}>
            {r.t}
          </Txt>
          <Row style={{ gap: 6 }}>
            {r.id === 'eco' ? <Leaf size={14} color={colors.lime} /> : null}
            <Txt v="smallStrong" color={r.a ? colors.midnight : colors.onDarkMuted}>
              {r.s}
            </Txt>
          </Row>
        </Row>
      ))}
    </View>
  );
}

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { code: countryCode, country } = useCountry();
  const [w, setW] = useState(0);
  const [i, setI] = useState(0);
  const ref = useRef<ScrollView>(null);
  const next_ = '/passenger/auth';
  useStatusTone('light');

  const slides = [
    { id: 'price', kicker: t('pax.onb.s1.kicker'), title: t('pax.onb.s1.title'), body: t('pax.onb.s1.body'), Art: PriceArt },
    {
      id: 'safety',
      kicker: t('pax.onb.s2.kicker'),
      title: t('pax.onb.s2.title'),
      body: t('pax.onb.s2.body', { emergencyLine: t(countryCode === 'CW' ? 'pax.emergency.CW' : 'pax.emergency.CO') }),
      Art: SafetyArt,
    },
    { id: 'rhythm', kicker: t('pax.onb.s3.kicker'), title: t('pax.onb.s3.title'), body: t('pax.onb.s3.body', { city: country.cityLong }), Art: RhythmArt },
  ];

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (w) setI(Math.round(e.nativeEvent.contentOffset.x / w));
  };
  const next = () => {
    if (i < slides.length - 1) ref.current?.scrollTo({ x: (i + 1) * w, animated: true });
    else router.replace(next_);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Row style={{ justifyContent: 'space-between', paddingTop: insets.top + 10, paddingHorizontal: space[5], gap: 12 }}>
        <Wordmark height={22} color={colors.ivory} />
        <Row style={{ gap: 14 }}>
          {/* New users can switch language before signing up. */}
          <LanguagePicker tone="dark" compact />
          <Tap onPress={() => router.replace(next_)} hitSlop={10}>
            <Txt v="smallStrong" color={colors.onDarkMuted}>
              {t('pax.onb.skip')}
            </Txt>
          </Tap>
        </Row>
      </Row>

      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        style={{ flex: 1 }}
      >
        {slides.map((s, idx) => (
          <View key={s.id} style={{ width: w || 390, paddingHorizontal: space[6], justifyContent: 'space-between', paddingTop: space[10], paddingBottom: space[4] }}>
            <View style={{ minHeight: 260, justifyContent: 'center' }}>{idx === i || Math.abs(idx - i) === 1 ? <s.Art /> : null}</View>
            <View>
              <Txt v="overline" color={colors.lime}>
                {s.kicker}
              </Txt>
              <Txt color={colors.ivory} style={{ fontFamily: fonts.extrabold, fontSize: 36, lineHeight: 39, letterSpacing: -1.5, marginTop: 12 }}>
                {s.title}
              </Txt>
              <Txt v="body" color={colors.onDarkMuted} style={{ marginTop: 14 }}>
                {s.body}
              </Txt>
            </View>
          </View>
        ))}
      </ScrollView>

      <Animated.View entering={FadeInUp.delay(200)} style={{ paddingHorizontal: space[6], paddingBottom: insets.bottom + space[5], gap: space[5] }}>
        <Row style={{ gap: 6 }}>
          {slides.map((s, idx) => (
            <View key={s.id} style={{ height: 6, width: idx === i ? 28 : 6, borderRadius: 3, backgroundColor: idx === i ? colors.lime : colors.midnight500 }} />
          ))}
        </Row>
        <Animated.View key={i} entering={FadeInDown.duration(250)}>
          <Button label={i === slides.length - 1 ? t('pax.onb.createAccount') : t('pax.onb.next')} onPress={next} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
