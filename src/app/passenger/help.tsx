import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ChevronDown, CircleCheck, MessageCircle, Package, Receipt, Search, SearchX, ShieldQuestion, UserX, Wallet } from 'lucide-react-native';
import { Button, Tap } from '../../components/ui/Button';
import { Card, Divider, EmptyState, Row, SectionHeader } from '../../components/ui/primitives';
import { Header, Screen, useToast } from '../../components/ui/Screen';
import { openTicket } from '../../lib/liveTrips';
import { useAuth } from '../../store/Auth';
import { Txt } from '../../components/ui/Txt';
import { TKey, useT } from '../../i18n';
import { cop } from '../../lib/format';
import { useApp } from '../../store/AppStore';
import { colors, fonts, radius, space } from '../../theme/tokens';

const FAQ: { id: string; icon: typeof Receipt; q: TKey; a: TKey }[] = [
  { id: 'fare', icon: Receipt, q: 'pax.help.q1', a: 'pax.help.a1' },
  { id: 'charged', icon: Wallet, q: 'pax.help.q2', a: 'pax.help.a2' },
  { id: 'lost', icon: Package, q: 'pax.help.q3', a: 'pax.help.a3' },
  { id: 'noshow', icon: UserX, q: 'pax.help.q4', a: 'pax.help.a4' },
  { id: 'safety', icon: ShieldQuestion, q: 'pax.help.q5', a: 'pax.help.a5' },
];

export default function HelpSupport() {
  const { passengerTrips } = useApp();
  const t = useT();
  const toast = useToast();
  const { live } = useAuth();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | null>(0);
  // Case number of the request just sent (live: a real support ticket the admin sees).
  const [caseCode, setCaseCode] = useState<string | null>(null);
  const sent = !!caseCode;
  const report = async (subject: string, body?: string) => {
    if (!live) return setCaseCode('TK-20934');
    try {
      setCaseCode(await openTicket(subject, body));
    } catch {
      toast(t('pax.help.sendError'), 'warning');
    }
  };
  const last = passengerTrips.find((trip) => trip.status === 'completado');

  // Search runs over the texts in the current language.
  const items = useMemo(() => {
    const all = FAQ.map((f) => ({ id: f.id, icon: f.icon, q: t(f.q), a: t(f.a) }));
    const n = q.trim().toLowerCase();
    return n ? all.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(n)) : all;
  }, [q, t]);

  return (
    <Screen header={<Header title={t('pax.help.title')} subtitle={t('pax.help.subtitle')} large />}>
      <Row style={{ height: 52, borderRadius: radius.pill, backgroundColor: colors.white, paddingHorizontal: 16, gap: 10, borderWidth: 1, borderColor: colors.lineLight }}>
        <Search size={18} color={colors.inkMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t('pax.help.searchPh')}
          placeholderTextColor={colors.stone}
          accessibilityLabel={t('pax.help.searchA11y')}
          style={[{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }, { outlineStyle: 'none' } as object]}
        />
      </Row>

      {last && !q ? (
        <>
          <SectionHeader title={t('pax.help.lastTrip')} style={{ marginTop: space[6] }} />
          <Card>
            <Txt v="bodyStrong">{last.to.name}</Txt>
            <Txt v="caption" color={colors.inkMuted}>
              {last.driverName} · {cop(last.fare.finalFare)}
            </Txt>
            {sent ? (
              <Animated.View entering={FadeIn}>
                <Row style={{ gap: 8, marginTop: space[3] }}>
                  <CircleCheck size={18} color={colors.limeInk} />
                  <Txt v="smallStrong" color={colors.limeInk}>
                    {t('pax.help.caseOpened', { code: caseCode ?? '' })}
                  </Txt>
                </Row>
              </Animated.View>
            ) : (
              <Button label={t('pax.help.tripProblem')} variant="outline" size="sm" full={false} style={{ marginTop: space[3] }} onPress={() => report(`${t('pax.help.tripProblem')}: ${last.id}`, `${last.from.name} → ${last.to.name} · ${cop(last.fare.finalFare)}`)} />
            )}
          </Card>
        </>
      ) : null}

      <SectionHeader title={t('pax.help.faq')} style={{ marginTop: space[6] }} />
      {items.length ? (
        <Card padded={false} style={{ paddingHorizontal: space[4] }}>
          {items.map((f, i) => {
            const expanded = open === i;
            return (
              <View key={f.id}>
                {i ? <Divider /> : null}
                <Tap onPress={() => setOpen(expanded ? null : i)} scaleTo={0.99} accessibilityState={{ expanded }}>
                  <Row style={{ paddingVertical: 16, gap: 12 }}>
                    <f.icon size={18} color={colors.ink} />
                    <Txt v="bodyStrong" style={{ flex: 1 }}>
                      {f.q}
                    </Txt>
                    <ChevronDown size={18} color={colors.inkMuted} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
                  </Row>
                </Tap>
                {expanded ? (
                  <Animated.View entering={FadeIn.duration(200)}>
                    <Txt v="body" color={colors.inkSoft} style={{ paddingLeft: 30, paddingBottom: 16 }}>
                      {f.a}
                    </Txt>
                  </Animated.View>
                ) : null}
              </View>
            );
          })}
        </Card>
      ) : (
        <EmptyState icon={SearchX} title={t('pax.help.noResults')} body={t('pax.help.noResultsBody')} />
      )}

      <Card tone="dark" style={{ marginTop: space[6] }}>
        <Txt v="h3" color={colors.ivory}>
          {t('pax.help.notFoundTitle')}
        </Txt>
        <Txt v="small" color={colors.onDarkMuted} style={{ marginTop: 4 }}>
          {t('pax.help.notFoundBody')}
        </Txt>
        <Button label={t('pax.help.chat')} icon={MessageCircle} size="md" style={{ marginTop: space[4] }} onPress={() => report(t('pax.help.chat'))} />
      </Card>
    </Screen>
  );
}
