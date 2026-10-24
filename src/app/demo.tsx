import React from 'react';
import { Linking, Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { router, Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowUpRight, Car, Download, UserRound } from 'lucide-react-native';
import { Aurora } from '../components/brand/Aurora';
import { AppIcon, Wordmark } from '../components/brand/Brand';
import { Tap } from '../components/ui/Button';
import { Row } from '../components/ui/primitives';
import { useStatusTone } from '../components/ui/Screen';
import { Txt } from '../components/ui/Txt';
import { colors, fonts, radius, shadow, space } from '../theme/tokens';
import { ANDROID_APK_URL } from '../lib/site';
import { commissionText } from '../lib/fare';
import { LanguagePicker } from '../components/ui/LanguagePicker';
import { localizeCountry } from '../lib/countries';
import { useCountry } from '../lib/country';
import { useApp } from '../store/AppStore';
import { type TKey, useLanguage, useT } from '../i18n';

const EXPERIENCES: { href: string; icon: typeof Car; kicker: TKey; title: TKey; body: TKey; tone: 'lime' | 'ivory' }[] = [
  {
    href: '/passenger',
    icon: UserRound,
    kicker: 'launcher.pax.kicker',
    title: 'launcher.pax.title',
    body: 'launcher.pax.body',
    tone: 'lime',
  },
  {
    href: '/driver',
    icon: Car,
    kicker: 'launcher.drv.kicker',
    title: 'launcher.drv.title',
    body: 'launcher.drv.body',
    tone: 'ivory',
  },
];

/**
 * Product launcher: entry point of the native app and of /demo on the web. Riders and
 * drivers only — the admin console is its own website (nuva--admin).
 */
export default function Launcher() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  useStatusTone('dark');
  const commission = commissionText(useApp().pricing);
  const { country } = useCountry();
  const t = useT();
  const { lang } = useLanguage();
  const copy = localizeCountry(country.code, lang);

  return (
    <View style={{ flex: 1, backgroundColor: colors.ivory100, overflow: 'hidden' }}>
      <Aurora layout={wide ? 'web' : 'app'} scale={wide ? 1.2 : 1} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space[8],
          paddingBottom: insets.bottom + space[10],
          paddingHorizontal: wide ? 72 : space[5],
          maxWidth: 1240,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <Wordmark height={wide ? 36 : 30} color={colors.midnight} />
          <AppIcon size={wide ? 48 : 40} />
        </Row>

        {/* Language before signing up (NÜVA only operates in Colombia: there is no country choice). */}
        <Row style={{ gap: 12, marginTop: space[8], flexWrap: 'wrap' }}>
          <LanguagePicker tone="light" />
        </Row>

        <Animated.View entering={FadeInDown.duration(600)} style={{ marginTop: wide ? 72 : 40, maxWidth: 760 }}>
          <Txt v="overline" color={colors.limeInk} style={{ fontSize: 13, lineHeight: 16, letterSpacing: 1 }}>
            {t('launcher.kicker', { city: copy.cityLong })}
          </Txt>
          {/* One Txt per line: nested spans with a tight lineHeight clip the last line on Android. */}
          <View style={{ marginTop: 18 }}>
            {[t('common.tagline.city'), t('common.tagline.rhythm'), t('common.tagline.price')].map((line, i) => (
              <Txt
                key={i}
                color={i === 2 ? colors.lime : colors.midnight}
                style={{ fontFamily: fonts.extrabold, fontSize: wide ? 76 : 44, lineHeight: wide ? 82 : 52, letterSpacing: wide ? -2 : -1.2, marginTop: i ? (wide ? -4 : -2) : 0 }}
              >
                {line}
              </Txt>
            ))}
          </View>
          <Txt v="body" color={colors.inkSoft} style={{ marginTop: 22, maxWidth: 520, fontSize: wide ? 18 : 15, lineHeight: wide ? 27 : 22 }}>
            {t('launcher.body', { commission })}
          </Txt>
        </Animated.View>

        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 14, marginTop: wide ? 72 : 40 }}>
          {EXPERIENCES.map((e, i) => {
            const dark = e.tone === 'lime';
            const bg = dark ? colors.midnight : colors.white;
            const fg = dark ? colors.ivory : colors.midnight;
            const sub = dark ? colors.onDarkMuted : colors.inkSoft;
            const Icon = e.icon;
            return (
              <Animated.View key={e.href} entering={FadeInDown.delay(150 + i * 90).duration(550)} style={{ flex: wide ? 1 : undefined }}>
                <Tap
                  onPress={() => router.push(e.href as Href)}
                  accessibilityLabel={`${t(e.kicker)}. ${t(e.title)}`}
                  style={[
                    {
                      backgroundColor: bg,
                      borderRadius: radius.xl,
                      padding: space[6],
                      minHeight: wide ? 300 : 0,
                      justifyContent: 'space-between',
                    },
                    dark ? shadow.float : shadow.soft,
                  ]}
                >
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 16,
                        backgroundColor: dark ? colors.lime : colors.limeSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={22} color={dark ? colors.onLime : colors.limeInk} strokeWidth={2.2} />
                    </View>
                    <ArrowUpRight size={24} color={fg} />
                  </Row>
                  <View style={{ marginTop: wide ? 0 : 28 }}>
                    <Txt v="overline" color={sub}>
                      {t(e.kicker)}
                    </Txt>
                    <Txt v="h2" color={fg} style={{ marginTop: 8 }}>
                      {t(e.title)}
                    </Txt>
                    <Txt v="body" color={sub} style={{ marginTop: 6 }}>
                      {t(e.body, { commission })}
                    </Txt>
                  </View>
                </Tap>
              </Animated.View>
            );
          })}
        </View>

        {Platform.OS === 'web' ? (
          <Tap
            onPress={() => Linking.openURL(ANDROID_APK_URL)}
            accessibilityLabel={t('launcher.downloadA11y')}
            style={[{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, paddingHorizontal: space[6], borderRadius: radius.xl, backgroundColor: colors.lime }, shadow.glow]}
          >
            <Download size={20} color={colors.onLime} />
            <View style={{ flex: 1 }}>
              <Txt v="title" color={colors.onLime}>
                {t('common.downloadAndroid')}
              </Txt>
              <Txt v="caption" color={colors.onLime}>
                {t('launcher.apkHint')}
              </Txt>
            </View>
            <ArrowUpRight size={20} color={colors.onLime} />
          </Tap>
        ) : null}

        <Txt v="caption" color={colors.inkMuted} style={{ marginTop: 32 }}>
          {t('launcher.footer', { city: copy.city, country: copy.name })}
        </Txt>
      </ScrollView>
    </View>
  );
}
