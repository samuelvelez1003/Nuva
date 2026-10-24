import React, { useRef, useState } from 'react';
import { Linking, Pressable } from 'react-native';
import Animated, { cancelAnimation, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BadgeCheck, KeyRound, PhoneCall, Share2, ShieldAlert, UserRound, X } from 'lucide-react-native';
import { Button, haptic } from '../../components/ui/Button';
import { Card, Divider, ListRow, Row, SectionHeader } from '../../components/ui/primitives';
import { Header, Screen, useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { useT } from '../../i18n';
import { colors, fonts, radius, space } from '../../theme/tokens';

const HOLD_MS = 1800;

function SosButton({ line, onTrigger }: { line: string; onTrigger: () => void }) {
  const t = useT();
  const p = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fill = useAnimatedStyle(() => ({ height: `${p.value * 100}%` }));
  const start = () => {
    haptic('medium');
    p.value = withTiming(1, { duration: HOLD_MS });
    timer.current = setTimeout(() => {
      haptic('warning');
      onTrigger();
      p.value = 0;
    }, HOLD_MS);
  };
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    cancelAnimation(p);
    p.value = withTiming(0, { duration: 200 });
  };
  return (
    <Pressable
      onPressIn={start}
      onPressOut={stop}
      accessibilityRole="button"
      accessibilityLabel={t('pax.safety.sosA11y', { line })}
      style={{ height: 132, borderRadius: radius.xl, backgroundColor: colors.danger, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}
    >
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#C9271B' }, fill]} />
      <ShieldAlert size={34} color={colors.white} />
      <Txt style={{ fontFamily: fonts.extrabold, fontSize: 22, marginTop: 6 }} color={colors.white}>
        {t('pax.safety.sosHold')}
      </Txt>
      <Txt v="caption" color="rgba(255,255,255,0.85)">
        {t('pax.safety.sosBody', { line })}
      </Txt>
    </Pressable>
  );
}

export default function SafetyCenter() {
  const toast = useToast();
  const t = useT();
  const [alert, setAlert] = useState(false);
  const line = t('pax.emergency.CO');

  return (
    <Screen header={<Header title={t('common.safetyCenter')} subtitle={t('pax.safety.subtitle')} large />}>
      {alert ? (
        <Animated.View entering={FadeIn} style={{ backgroundColor: colors.midnight, borderRadius: radius.xl, padding: space[5] }}>
          <Row style={{ gap: 12 }}>
            <PhoneCall size={22} color={colors.lime} />
            <Txt v="h3" color={colors.ivory} style={{ flex: 1 }}>
              {t('pax.safety.connecting', { line })}
            </Txt>
          </Row>
          <Txt v="body" color={colors.onDarkMuted} style={{ marginTop: 10 }}>
            {t('pax.safety.alertBody', { line })}
          </Txt>
          <Button
            label={t('pax.safety.cancelAlert')}
            icon={X}
            variant="outlineDark"
            size="md"
            style={{ marginTop: space[4] }}
            onPress={() => {
              setAlert(false);
              toast(t('pax.safety.alertCancelled'), 'info');
            }}
          />
        </Animated.View>
      ) : (
        <SosButton
          line={line}
          onTrigger={() => {
            setAlert(true);
            // Real call to Colombia's emergency line.
            Linking.openURL('tel:123').catch(() => {});
          }}
        />
      )}

      <SectionHeader title={t('pax.safety.tools')} style={{ marginTop: space[6] }} />
      <Card padded={false} style={{ paddingHorizontal: space[4] }}>
        <ListRow icon={KeyRound} title={t('pax.safety.pinTitle')} subtitle={t('pax.safety.pinSub')} chevron={false} />
        <Divider inset={54} />
        {/* Sharing happens from the ride screen, with the real driver and plate. */}
        <ListRow icon={Share2} title={t('pax.safety.shareTitle')} subtitle={t('pax.safety.shareFromRide')} chevron={false} />
        <Divider inset={54} />
        <ListRow icon={BadgeCheck} title={t('pax.safety.verifiedTitle')} subtitle={t('pax.safety.verifiedSub')} chevron={false} />
      </Card>

      <Card tone="ivory" style={{ marginTop: space[6] }}>
        <Row style={{ gap: 12, alignItems: 'flex-start' }}>
          <UserRound size={18} color={colors.ink} />
          <Txt v="small" color={colors.inkSoft} style={{ flex: 1 }}>
            {t('pax.safety.tip')}
          </Txt>
        </Row>
      </Card>
    </Screen>
  );
}
