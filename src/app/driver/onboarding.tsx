import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowRight, Car, FileCheck2, IdCard, Percent, Wallet, Eye } from 'lucide-react-native';
import { BrandRings, Wordmark } from '../../components/brand/Brand';
import { Button } from '../../components/ui/Button';
import { LanguagePicker } from '../../components/ui/LanguagePicker';
import { Row } from '../../components/ui/primitives';
import { useT } from '../../i18n';
import { Screen } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { useApp } from '../../store/AppStore';
import { commissionText } from '../../lib/fare';
import { useCountry } from '../../lib/country';
import { backendEnabled } from '../../lib/supabase';
import { colors, fonts, radius, space } from '../../theme/tokens';

export default function DriverOnboarding() {
  const insets = useSafeAreaInsets();
  const { pricing } = useApp();
  const { country } = useCountry();
  const tr = useT();
  const props = [
    { icon: Percent, t: tr('common.fixedCommission', { commission: commissionText(pricing) }), d: tr('drv.onb.commissionBody') },
    { icon: Eye, t: tr('drv.onb.netTitle'), d: tr('drv.onb.netBody') },
    { icon: Wallet, t: tr('drv.onb.paidTitle'), d: tr('drv.onb.paidBody', { payments: country.web.paymentNames.join(', ') }) },
  ];
  const steps = [
    { icon: IdCard, t: tr('drv.onb.step1Title'), d: tr('drv.onb.step1Body'), href: '/driver/verify' as const },
    { icon: Car, t: tr('drv.onb.step2Title'), d: tr('drv.onb.step2Body'), href: '/driver/vehicle' as const },
    { icon: FileCheck2, t: tr('drv.onb.step3Title'), d: tr(country.code === 'CW' ? 'drv.onb.step3BodyCW' : 'drv.onb.step3Body'), href: '/driver/documents' as const },
  ];
  return (
    <Screen
      bg={colors.midnight}
      padded={false}
      contentStyle={{ paddingTop: 0 }}
      footer={
        <Button
          label={backendEnabled ? tr('drv.onb.ctaAuth') : tr('drv.onb.ctaStart')}
          iconRight={ArrowRight}
          onPress={() => router.push(backendEnabled ? '/driver/auth' : '/driver/verify')}
        />
      }
    >
      <View style={{ paddingHorizontal: space[5], paddingTop: insets.top + space[3], overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', right: -170, top: -60, opacity: 0.8 }}>
          <BrandRings size={460} />
        </View>
        <Row style={{ gap: 10 }}>
          <Wordmark height={22} color={colors.ivory} />
          <View style={{ paddingHorizontal: 8, height: 22, borderRadius: 6, backgroundColor: colors.lime, justifyContent: 'center' }}>
            <Txt v="caption" color={colors.midnight} style={{ fontFamily: fonts.extrabold }}>
              {tr('common.driverBadge')}
            </Txt>
          </View>
          <View style={{ flex: 1 }} />
          <LanguagePicker tone="dark" compact />
        </Row>
        <Txt color={colors.ivory} style={{ fontFamily: fonts.extrabold, fontSize: 44, lineHeight: 46, letterSpacing: -2, marginTop: space[10] }}>
          {tr('drv.onb.headline1')}
          {'\n'}
          <Txt color={colors.lime} style={{ fontFamily: fonts.extrabold, fontSize: 44, letterSpacing: -2 }}>
            {tr('drv.onb.headline2')}
          </Txt>
        </Txt>
      </View>

      <View style={{ paddingHorizontal: space[5], marginTop: space[8], gap: space[4] }}>
        {props.map((p, i) => (
          <Animated.View key={p.t} entering={FadeInDown.delay(100 + i * 90)}>
            <Row style={{ gap: 14, alignItems: 'flex-start' }}>
              <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.midnight600, alignItems: 'center', justifyContent: 'center' }}>
                <p.icon size={18} color={colors.lime} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="title" color={colors.ivory}>
                  {p.t}
                </Txt>
                <Txt v="small" color={colors.onDarkMuted}>
                  {p.d}
                </Txt>
              </View>
            </Row>
          </Animated.View>
        ))}
      </View>

      <View style={{ margin: space[5], marginTop: space[8], borderRadius: radius.xl, backgroundColor: colors.midnight700, borderWidth: 1, borderColor: colors.lineDark, padding: space[4] }}>
        <Txt v="overline" color={colors.onDarkMuted} style={{ marginBottom: 6 }}>
          {tr('drv.onb.stepsTitle')}
        </Txt>
        {steps.map((s, i) => (
          <Row key={s.t} style={{ gap: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.lineDark }}>
            <Txt style={{ fontFamily: fonts.extrabold, fontSize: 15, width: 18 }} color={colors.lime}>
              {i + 1}
            </Txt>
            <View style={{ flex: 1 }}>
              <Txt v="bodyStrong" color={colors.ivory}>
                {s.t}
              </Txt>
              <Txt v="caption" color={colors.onDarkMuted}>
                {s.d}
              </Txt>
            </View>
            <s.icon size={18} color={colors.onDarkMuted} />
          </Row>
        ))}
      </View>
    </Screen>
  );
}
