import React from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { Href, router } from 'expo-router';
import Head from 'expo-router/head';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ArrowRight, Banknote, MapPin, Wallet } from 'lucide-react-native';
import { BrandRings, Wordmark } from '../brand/Brand';
import { Flag } from '../brand/Flags';
import { Tap } from '../ui/Button';
import { LanguagePicker } from '../ui/LanguagePicker';
import { Row } from '../ui/primitives';
import { Txt } from '../ui/Txt';
import { CountryCode, localizeCountry } from '../../lib/countries';
import { useCountry } from '../../lib/country';
import { type TKey, useLanguage, useT } from '../../i18n';
import { colors, fonts, radius, space } from '../../theme/tokens';

const PANELS: { code: CountryCode; href: string; tone: 'dark' | 'lime'; kicker: TKey; cities: TKey }[] = [
  { code: 'CO', href: '/colombia', tone: 'dark', kicker: 'home.kicker.CO', cities: 'home.cities.CO' },
  { code: 'CW', href: '/curazao', tone: 'lime', kicker: 'home.kicker.CW', cities: 'home.cities.CW' },
];

/** Public homepage: pick a country, each half leads to that country's site. */
export default function CountryHome() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { setCountry } = useCountry();
  const t = useT();
  const { lang } = useLanguage();

  const enter = (code: CountryCode, href: string) => {
    setCountry(code);
    router.push(href as Href);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight }}>
      <Head>
        <title>{t('web.meta.title')}</title>
        <meta name="description" content={t('home.meta.description')} />
      </Head>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        <View style={{ flex: 1, minHeight: wide ? '100%' : undefined, flexDirection: wide ? 'row' : 'column' }}>
          {PANELS.map((p, i) => {
            const c = localizeCountry(p.code, lang);
            const dark = p.tone === 'dark';
            const fg = dark ? colors.ivory : colors.midnight;
            const sub = dark ? colors.onDarkMuted : 'rgba(16,20,17,0.68)';
            return (
              <Tap
                key={p.code}
                haptics={false}
                scaleTo={0.99}
                onPress={() => enter(p.code, p.href)}
                accessibilityLabel={t('home.enterA11y', { country: c.name })}
                style={{
                  flex: 1,
                  minHeight: wide ? undefined : 460,
                  backgroundColor: dark ? colors.midnight : colors.lime,
                  overflow: 'hidden',
                  paddingHorizontal: wide ? 72 : space[6],
                  paddingTop: wide ? 150 : i === 0 ? 120 : space[10],
                  paddingBottom: wide ? 72 : space[10],
                  justifyContent: 'space-between',
                }}
              >
                <View pointerEvents="none" style={{ position: 'absolute', right: -180, bottom: -200, opacity: dark ? 0.9 : 0.35 }}>
                  <BrandRings size={wide ? 640 : 480} />
                </View>

                <Animated.View entering={FadeInDown.delay(150 + i * 120).duration(600)}>
                  <Row style={{ gap: 12 }}>
                    <View style={{ borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: dark ? colors.lineDarkStrong : 'rgba(16,20,17,0.2)' }}>
                      <Flag code={p.code} width={wide ? 60 : 48} />
                    </View>
                    <View style={{ paddingHorizontal: 10, height: 26, borderRadius: radius.pill, backgroundColor: dark ? colors.lime : colors.midnight, justifyContent: 'center' }}>
                      <Txt v="caption" color={dark ? colors.midnight : colors.lime}>
                        {t(p.kicker)}
                      </Txt>
                    </View>
                  </Row>
                  <Txt
                    color={fg}
                    style={{ fontFamily: fonts.extrabold, fontSize: wide ? 104 : 64, lineHeight: wide ? 108 : 68, letterSpacing: wide ? -5 : -3, marginTop: space[6] }}
                  >
                    {c.name}
                  </Txt>
                  <Row style={{ gap: 8, marginTop: 10 }}>
                    <MapPin size={18} color={sub} />
                    <Txt v="bodyStrong" color={sub} style={{ fontSize: wide ? 20 : 17 }}>
                      {t(p.cities)}
                    </Txt>
                  </Row>
                </Animated.View>

                <Animated.View entering={FadeIn.delay(400 + i * 120).duration(600)} style={{ gap: space[5], marginTop: space[8] }}>
                  <View style={{ gap: 10 }}>
                    <Row style={{ gap: 10 }}>
                      <Banknote size={18} color={fg} />
                      <Txt v="body" color={fg}>
                        {c.currencyName} · {c.currency}
                      </Txt>
                    </Row>
                    <Row style={{ gap: 10, alignItems: 'flex-start' }}>
                      <Wallet size={18} color={fg} style={{ marginTop: 2 }} />
                      <Txt v="body" color={fg} style={{ flex: 1 }}>
                        {c.web.paymentNames.join(' · ')}
                      </Txt>
                    </Row>
                  </View>
                  <Row
                    style={{
                      alignSelf: 'flex-start',
                      gap: 12,
                      height: 60,
                      paddingLeft: 28,
                      paddingRight: 10,
                      borderRadius: radius.pill,
                      backgroundColor: dark ? colors.lime : colors.midnight,
                    }}
                  >
                    <Txt v="title" color={dark ? colors.midnight : colors.ivory}>
                      {t('home.enter', { country: c.name })}
                    </Txt>
                    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: dark ? colors.midnight : colors.lime, alignItems: 'center', justifyContent: 'center' }}>
                      <ArrowRight size={20} color={dark ? colors.lime : colors.midnight} strokeWidth={2.4} />
                    </View>
                  </Row>
                </Animated.View>
              </Tap>
            );
          })}
          {/* Brand bar over both halves; it scrolls with the page (doesn't cover the text). */}
          {/* Only the language switch takes touches; the rest lets taps reach the country panels. */}
          <View pointerEvents="box-none" style={{ position: 'absolute', top: wide ? 40 : 28, left: 0, right: 0, alignItems: 'center', gap: 10, paddingHorizontal: space[4] }}>
            <Row pointerEvents="box-none" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <View pointerEvents="none" style={{ paddingHorizontal: 22, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: 'rgba(16,20,17,0.85)', alignItems: 'center', gap: 6 }}>
                <Wordmark height={wide ? 30 : 24} color={colors.ivory} />
              </View>
              <View style={{ padding: wide ? 8 : 6, borderRadius: radius.pill, backgroundColor: 'rgba(16,20,17,0.85)' }}>
                <LanguagePicker tone="dark" compact={!wide} />
              </View>
            </Row>
            <View pointerEvents="none">
              <Txt v="overline" color={wide ? colors.ivory : colors.onDarkMuted} style={{ letterSpacing: 2 }}>
                {t('home.pickCountry')}
              </Txt>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
