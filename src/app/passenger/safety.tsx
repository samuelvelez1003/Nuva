import React, { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { cancelAnimation, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BadgeCheck, KeyRound, Mic, PhoneCall, Plus, Share2, ShieldAlert, UserRound, X } from 'lucide-react-native';
import { Button, haptic } from '../../components/ui/Button';
import { Avatar, Card, Divider, ListRow, Row, SectionHeader } from '../../components/ui/primitives';
import { Header, Screen, useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { useT } from '../../i18n';
import { useCountry } from '../../lib/country';
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
  const { code: countryCode } = useCountry();
  const [alert, setAlert] = useState(false);
  const line = t(countryCode === 'CW' ? 'pax.emergency.CW' : 'pax.emergency.CO');

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
            {t('pax.safety.alertBody')}
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
        <SosButton line={line} onTrigger={() => setAlert(true)} />
      )}

      <SectionHeader
        title={t('pax.safety.contacts')}
        action={t('pax.safety.add')}
        onAction={() => toast(t('pax.safety.pickContact'), 'info')}
        style={{ marginTop: space[6] }}
      />
      <Card padded={false} style={{ paddingHorizontal: space[4] }}>
        {[
          { id: 'mom', n: t('pax.contact.mom'), d: t('pax.safety.momSub'), i: 'MR', bg: '#E5D3B8' },
          { id: 'daniel', n: 'Daniel Ospina', d: t('pax.safety.onlyWhenShare'), i: 'DO', bg: '#BFD2DA' },
        ].map((c, i) => (
          <View key={c.id}>
            {i ? <Divider inset={58} /> : null}
            <Row style={{ paddingVertical: 12, gap: 14 }}>
              <Avatar initials={c.i} size={44} bg={c.bg} />
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong">{c.n}</Txt>
                <Txt v="caption" color={colors.inkMuted}>
                  {c.d}
                </Txt>
              </View>
            </Row>
          </View>
        ))}
      </Card>

      <SectionHeader title={t('pax.safety.tools')} style={{ marginTop: space[6] }} />
      <Card padded={false} style={{ paddingHorizontal: space[4] }}>
        <ListRow icon={KeyRound} title={t('pax.safety.pinTitle')} subtitle={t('pax.safety.pinSub')} chevron={false} />
        <Divider inset={54} />
        <ListRow icon={Share2} title={t('pax.safety.shareTitle')} subtitle={t('pax.safety.shareSub')} onPress={() => toast(t('pax.safety.linkCopied'))} />
        <Divider inset={54} />
        <ListRow icon={Mic} title={t('pax.safety.audioTitle')} subtitle={t('pax.safety.audioSub')} onPress={() => toast(t('pax.safety.audioOn'), 'info')} />
        <Divider inset={54} />
        <ListRow icon={BadgeCheck} title={t('pax.safety.verifiedTitle')} subtitle={t(countryCode === 'CW' ? 'pax.safety.verifiedSubCW' : 'pax.safety.verifiedSub')} chevron={false} />
      </Card>

      <Card tone="ivory" style={{ marginTop: space[6] }}>
        <Row style={{ gap: 12, alignItems: 'flex-start' }}>
          <UserRound size={18} color={colors.ink} />
          <Txt v="small" color={colors.inkSoft} style={{ flex: 1 }}>
            {t('pax.safety.tip')}
          </Txt>
        </Row>
      </Card>
      <Button label={t('pax.safety.addContact')} icon={Plus} variant="outline" style={{ marginTop: space[4] }} onPress={() => toast(t('pax.safety.pickContact'), 'info')} />
    </Screen>
  );
}
