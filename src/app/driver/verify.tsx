import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../../store/Auth';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Camera, Check, ScanFace, UserRound } from 'lucide-react-native';
import { Ring } from '../../components/charts/Charts';
import { Button } from '../../components/ui/Button';
import { Row } from '../../components/ui/primitives';
import { Header, Screen } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { DRIVER_ME } from '../../data/mock';
import { useProgress } from '../../lib/hooks';
import { useT } from '../../i18n';
import { colors, fonts, radius, space } from '../../theme/tokens';

type Step = 'id' | 'id-processing' | 'selfie' | 'selfie-scanning' | 'done';

function Corners() {
  const c = { position: 'absolute' as const, width: 28, height: 28, borderColor: colors.lime };
  return (
    <>
      <View style={[c, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 }]} />
      <View style={[c, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 }]} />
      <View style={[c, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14 }]} />
      <View style={[c, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14 }]} />
    </>
  );
}

/** Stylised Colombian cédula (mock — no real data). */
function IdCardMock() {
  return (
    <Animated.View entering={ZoomIn.springify()} style={{ width: '100%', aspectRatio: 1.58, borderRadius: 14, backgroundColor: '#E9E4D4', padding: 14, overflow: 'hidden' }}>
      <View style={{ height: 6, flexDirection: 'row', marginBottom: 8 }}>
        <View style={{ flex: 2, backgroundColor: '#FCD116' }} />
        <View style={{ flex: 1, backgroundColor: '#003893' }} />
        <View style={{ flex: 1, backgroundColor: '#CE1126' }} />
      </View>
      <Txt style={{ fontFamily: fonts.extrabold, fontSize: 9, letterSpacing: 1 }} color="#4A4A3F">
        REPÚBLICA DE COLOMBIA · CÉDULA DE CIUDADANÍA
      </Txt>
      <Row style={{ gap: 12, marginTop: 10, alignItems: 'flex-start' }}>
        <View style={{ width: 62, height: 76, borderRadius: 6, backgroundColor: '#C9C2AC', alignItems: 'center', justifyContent: 'center' }}>
          <UserRound size={34} color="#8F876F" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt style={{ fontFamily: fonts.bold, fontSize: 9 }} color="#6E6A5A">
            NÚMERO
          </Txt>
          <Txt style={{ fontFamily: fonts.extrabold, fontSize: 14, letterSpacing: 1 }} color="#2B2A24">
            1.0•• •••.482
          </Txt>
          <Txt style={{ fontFamily: fonts.bold, fontSize: 9 }} color="#6E6A5A">
            APELLIDOS · NOMBRES
          </Txt>
          <Txt style={{ fontFamily: fonts.extrabold, fontSize: 12 }} color="#2B2A24">
            {DRIVER_ME.lastName.toUpperCase()} · {DRIVER_ME.firstName.toUpperCase()}
          </Txt>
        </View>
      </Row>
    </Animated.View>
  );
}

export default function IdentityVerification() {
  const { live } = useAuth();
  // Real accounts are verified by an admin from their sign-up data; this walkthrough is demo-only.
  return live ? <Redirect href="/driver" /> : <DemoIdentityVerification />;
}

/** Demo walkthrough (no backend). */
function DemoIdentityVerification() {
  const t = useT();
  const [step, setStep] = useState<Step>('id');
  const scan = useProgress(2600, step === 'selfie-scanning', step, () => setStep('done'));

  useEffect(() => {
    if (step !== 'id-processing') return;
    const id = setTimeout(() => setStep('selfie'), 1600);
    return () => clearTimeout(id);
  }, [step]);

  const isId = step === 'id' || step === 'id-processing';

  return (
    <Screen
      bg={colors.midnight}
      header={<Header title={t('drv.profile.identity')} tone="dark" />}
      footer={
        step === 'id' ? (
          <Button label={t('drv.verify.takeIdPhoto')} icon={Camera} onPress={() => setStep('id-processing')} />
        ) : step === 'selfie' ? (
          <Button label={t('drv.verify.startSelfie')} icon={ScanFace} onPress={() => setStep('selfie-scanning')} />
        ) : step === 'done' ? (
          <Button label={t('drv.verify.continueVehicle')} onPress={() => router.replace('/driver/vehicle')} />
        ) : (
          <Button label={t('drv.verify.processing')} loading disabled />
        )
      }
    >
      <Row style={{ gap: 6, marginBottom: space[5] }}>
        {[t('drv.verify.stepId'), t('drv.verify.stepSelfie'), t('drv.verify.stepDone')].map((l, i) => {
          const active = (i === 0 && isId) || (i === 1 && step.startsWith('selfie')) || (i === 2 && step === 'done');
          const done = (i === 0 && !isId) || (i === 1 && step === 'done');
          return (
            <View key={l} style={{ flex: 1 }}>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: done || active ? colors.lime : colors.midnight600 }} />
              <Txt v="caption" color={active ? colors.ivory : colors.onDarkFaint} style={{ marginTop: 6 }}>
                {l}
              </Txt>
            </View>
          );
        })}
      </Row>

      {isId ? (
        <Animated.View entering={FadeIn}>
          <Txt v="h2" color={colors.ivory}>
            {t('drv.verify.idTitle')}
          </Txt>
          <Txt v="body" color={colors.onDarkMuted} style={{ marginTop: 6 }}>
            {t('drv.verify.idBody')}
          </Txt>
          <View style={{ marginTop: space[6], padding: 14, borderRadius: radius.xl, backgroundColor: colors.midnight700 }}>
            <View style={{ padding: 10 }}>
              <Corners />
              {step === 'id-processing' ? (
                <View>
                  <IdCardMock />
                  <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,20,17,0.45)', borderRadius: 14 }}>
                    <ActivityIndicator color={colors.lime} />
                    <Txt v="smallStrong" color={colors.ivory} style={{ marginTop: 8 }}>
                      {t('drv.verify.ocr')}
                    </Txt>
                  </View>
                </View>
              ) : (
                <View style={{ width: '100%', aspectRatio: 1.58, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.midnight400, alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={30} color={colors.onDarkMuted} />
                  <Txt v="small" color={colors.onDarkMuted} style={{ marginTop: 8 }}>
                    {t('drv.verify.cameraSim')}
                  </Txt>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      ) : null}

      {step === 'selfie' || step === 'selfie-scanning' ? (
        <Animated.View entering={FadeIn} style={{ alignItems: 'center' }}>
          <Txt v="h2" color={colors.ivory} align="center">
            {t('drv.verify.selfieTitle')}
          </Txt>
          <Txt v="body" color={colors.onDarkMuted} align="center" style={{ marginTop: 6 }}>
            {step === 'selfie-scanning' ? (scan < 0.5 ? t('drv.verify.turnLeft') : t('drv.verify.turnRight')) : t('drv.verify.selfieBody')}
          </Txt>
          <View style={{ marginTop: space[8] }}>
            <Ring size={230} stroke={6} progress={scan} track={colors.midnight600}>
              <View style={{ width: 200, height: 200, borderRadius: 100, backgroundColor: colors.midnight700, alignItems: 'center', justifyContent: 'center' }}>
                <ScanFace size={86} color={step === 'selfie-scanning' ? colors.lime : colors.onDarkMuted} strokeWidth={1.2} />
              </View>
            </Ring>
          </View>
          <Txt v="caption" color={colors.onDarkFaint} style={{ marginTop: space[5] }}>
            {t('drv.verify.liveness')}
          </Txt>
        </Animated.View>
      ) : null}

      {step === 'done' ? (
        <Animated.View entering={FadeIn} style={{ alignItems: 'center', paddingTop: space[8] }}>
          <Animated.View entering={ZoomIn.springify()} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
            <Check size={48} color={colors.midnight} strokeWidth={3} />
          </Animated.View>
          <Txt v="h2" color={colors.ivory} style={{ marginTop: space[5] }}>
            {t('drv.verify.doneTitle')}
          </Txt>
          <Txt v="body" color={colors.onDarkMuted} align="center" style={{ marginTop: 6 }}>
            {t('drv.verify.doneBody', { name: `${DRIVER_ME.firstName} ${DRIVER_ME.lastName}`, pct: '98,7' })}
          </Txt>
        </Animated.View>
      ) : null}
    </Screen>
  );
}
