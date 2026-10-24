import React, { useRef, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { cancelAnimation, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BadgeCheck, CheckCircle2, Flag, KeyRound, MapPin, PhoneCall, ScanFace, Share2, ShieldAlert, Sparkles, UserRound, X } from 'lucide-react-native';
import { Button, haptic } from '../../components/ui/Button';
import { Card, Divider, Field, ListRow, Row, SectionHeader } from '../../components/ui/primitives';
import { Header, Screen, useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { useT } from '../../i18n';
import { openTicket } from '../../lib/liveTrips';
import { useApp } from '../../store/AppStore';
import { useAuth } from '../../store/Auth';
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

/**
 * "Reportar un problema de seguridad": opens a support case of kind 'seguridad' (linked to
 * the trip on screen, if any) that the NÜVA team sees first; shows the case number.
 */
function SafetyReport() {
  const t = useT();
  const toast = useToast();
  const { live, session } = useAuth();
  const { ride } = useApp();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [caseCode, setCaseCode] = useState<string | null>(null);

  const send = async () => {
    if (!live || !session) return toast(t('pax.safety.reportSignIn'), 'info');
    setBusy(true);
    try {
      const code = await openTicket(subject.trim() || t('pax.safety.reportTitle'), body.trim() || undefined, ride?.tripId, 'seguridad');
      setCaseCode(code);
      setOpen(false);
      setSubject('');
      setBody('');
    } catch {
      toast(t('pax.help.sendError'), 'warning');
    } finally {
      setBusy(false);
    }
  };

  if (caseCode) {
    return (
      <Animated.View entering={FadeIn}>
        <Card tone="dark" style={{ marginTop: space[6] }}>
          <Row style={{ gap: 12 }}>
            <CheckCircle2 size={22} color={colors.lime} />
            <Txt v="title" color={colors.ivory} style={{ flex: 1 }}>
              {t('pax.safety.reportSent', { code: caseCode })}
            </Txt>
          </Row>
          <Txt v="small" color={colors.onDarkMuted} style={{ marginTop: 8 }}>
            {t('pax.safety.reportSentBody')}
          </Txt>
          <Button label={t('pax.safety.reportAnother')} variant="outlineDark" size="md" style={{ marginTop: space[4] }} onPress={() => setCaseCode(null)} />
        </Card>
      </Animated.View>
    );
  }

  return (
    <Card style={{ marginTop: space[6] }}>
      <Row style={{ gap: 12, alignItems: 'flex-start' }}>
        <Flag size={18} color={colors.dangerInk} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Txt v="title">{t('pax.safety.reportTitle')}</Txt>
          <Txt v="small" color={colors.inkMuted}>
            {t('pax.safety.reportSub')}
          </Txt>
        </View>
      </Row>
      {open ? (
        <View style={{ gap: space[3], marginTop: space[4] }}>
          <Field label={t('pax.safety.reportSubject')} value={subject} onChangeText={setSubject} placeholder={t('pax.safety.reportSubjectPh')} maxLength={120} />
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={t('pax.safety.reportBodyPh')}
            placeholderTextColor={colors.stone}
            accessibilityLabel={t('pax.safety.reportBodyPh')}
            multiline
            maxLength={2000}
            style={[{ minHeight: 96, borderRadius: radius.md, backgroundColor: colors.ivory100, padding: 14, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, textAlignVertical: 'top' }, { outlineStyle: 'none' } as object]}
          />
          <Button label={t('pax.safety.reportSend')} variant="danger" size="md" loading={busy} disabled={!subject.trim() && !body.trim()} onPress={send} />
          <Button label={t('common.cancel')} variant="ghost" size="md" onPress={() => setOpen(false)} />
        </View>
      ) : (
        <Button label={t('pax.safety.reportTitle')} icon={Flag} variant="outline" size="md" style={{ marginTop: space[4] }} onPress={() => setOpen(true)} />
      )}
    </Card>
  );
}

export default function SafetyCenter() {
  const toast = useToast();
  const t = useT();
  const { profile } = useAuth();
  const [alert, setAlert] = useState(false);
  const line = t('pax.emergency.CO');
  const call123 = () => Linking.openURL('tel:123').catch(() => {});

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
            call123();
          }}
        />
      )}

      <SectionHeader title={t('pax.safety.tools')} style={{ marginTop: space[6] }} />
      <Card padded={false} style={{ paddingHorizontal: space[4] }}>
        <ListRow icon={KeyRound} title={t('pax.safety.pinTitle')} subtitle={t('pax.safety.pinSub')} chevron={false} />
        <Divider inset={54} />
        {/* Sharing happens from the ride screen: a public link that follows the car live. */}
        <ListRow icon={Share2} title={t('pax.safety.liveTitle')} subtitle={t('pax.safety.liveSub')} chevron={false} />
        <Divider inset={54} />
        <ListRow icon={ScanFace} title={t('pax.safety.selfieTitle')} subtitle={t('pax.safety.selfieSub')} chevron={false} />
        <Divider inset={54} />
        <ListRow icon={BadgeCheck} title={t('pax.safety.verifiedTitle')} subtitle={t('pax.safety.verifiedSub')} chevron={false} />
        <Divider inset={54} />
        {/* NÜVA Mujeres is switched on from the profile ("Soy mujer"). */}
        <ListRow
          icon={Sparkles}
          title={t('pax.safety.womenTitle')}
          subtitle={profile?.gender === 'f' ? t('pax.safety.womenOn') : t('pax.safety.womenSub')}
          onPress={profile?.gender === 'f' ? undefined : () => router.push('/passenger/profile')}
          chevron={profile?.gender !== 'f'}
        />
        <Divider inset={54} />
        <ListRow icon={MapPin} title={t('pax.safety.pointsTitle')} subtitle={t('pax.safety.pointsSub')} chevron={false} />
        <Divider inset={54} />
        <ListRow icon={PhoneCall} title={t('pax.safety.lineTitle', { line })} subtitle={t('pax.safety.lineSub')} onPress={call123} />
      </Card>

      <SafetyReport />

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
