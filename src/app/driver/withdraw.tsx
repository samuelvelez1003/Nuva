import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../../store/Auth';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Building2, Check, Smartphone, Zap } from 'lucide-react-native';
import { Button, Tap } from '../../components/ui/Button';
import { Badge, Card, Chip, Divider, KeyValue, Row, SectionHeader } from '../../components/ui/primitives';
import { Header, Screen } from '../../components/ui/Screen';
import { Money, Txt } from '../../components/ui/Txt';
import { DRIVER_ME } from '../../data/mock';
import { useT } from '../../i18n';
import { cop, dayLabel, num, parseInteger } from '../../lib/format';
import { availableBalance, useApp } from '../../store/AppStore';
import { colors, fonts, radius, space } from '../../theme/tokens';

const MIN = 20_000;
const DESTS: { id: string; label: string; detail: string; instant: boolean; fee: number; icon: typeof Smartphone }[] = [
  { id: 'nequi', label: 'Nequi', detail: DRIVER_ME.nequi, instant: true, fee: 0, icon: Smartphone },
  { id: 'bank', label: 'Bancolombia', detail: DRIVER_ME.bank, instant: false, fee: 0, icon: Building2 },
];

export default function Withdraw() {
  const { live } = useAuth();
  // The NÜVA balance is prepaid (it only pays commissions) and can't be withdrawn; passengers pay drivers directly.
  return live ? <Redirect href="/driver/wallet" /> : <DemoWithdraw />;
}

/** Demo walkthrough (no backend). */
function DemoWithdraw() {
  const t = useT();
  const { driverTrips, withdrawals, withdraw } = useApp();
  const balance = availableBalance(driverTrips, withdrawals);
  const [amount, setAmount] = useState(Math.floor(balance / 1000) * 1000);
  const [dest, setDest] = useState('nequi');
  const [done, setDone] = useState<null | number>(null);
  const [loading, setLoading] = useState(false);

  const d = DESTS.find((x) => x.id === dest)!;
  const error = amount > balance ? t('drv.withdraw.errBalance') : amount > 0 && amount < MIN ? t('drv.withdraw.errMin', { amount: cop(MIN) }) : undefined;
  const valid = !error && amount >= MIN;

  if (done !== null) {
    return (
      <Screen bg={colors.midnight} header={<Header tone="dark" back={false} />} footer={<Button label={t('drv.withdraw.backEarnings')} onPress={() => router.back()} />}>
        <View style={{ alignItems: 'center', paddingTop: space[10] }}>
          <Animated.View entering={ZoomIn.springify()} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
            <Check size={48} color={colors.midnight} strokeWidth={3} />
          </Animated.View>
          <Animated.View entering={FadeIn.delay(200)} style={{ alignItems: 'center' }}>
            <Txt v="overline" color={colors.onDarkMuted} style={{ marginTop: space[6] }}>
              {t('drv.withdraw.doneTitle')}
            </Txt>
            <Money value={cop(done)} size={48} color={colors.ivory} signColor={colors.lime} style={{ marginTop: 8 }} />
            <Txt v="body" color={colors.onDarkMuted} align="center" style={{ marginTop: 8, maxWidth: 280 }}>
              {t(d.instant ? 'drv.withdraw.doneInstant' : 'drv.withdraw.doneNextDay', { dest: d.label })}
            </Txt>
          </Animated.View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      bg={colors.midnight}
      header={<Header title={t('drv.withdraw.title')} tone="dark" />}
      footer={
        <Button
          label={valid ? t('drv.withdraw.withdrawAmount', { amount: cop(amount) }) : t('drv.withdraw.title')}
          disabled={!valid}
          loading={loading}
          onPress={() => {
            setLoading(true);
            setTimeout(() => {
              withdraw(amount, d.detail);
              setLoading(false);
              setDone(amount);
            }, 900);
          }}
        />
      }
    >
      <Txt v="caption" color={colors.onDarkMuted}>
        {t('drv.withdraw.available')}
      </Txt>
      <Txt v="title" color={colors.ivory} tabular>
        {cop(balance)}
      </Txt>

      <View style={{ marginTop: space[6], alignItems: 'center' }}>
        <Row style={{ alignItems: 'flex-start' }}>
          <Txt style={{ fontFamily: fonts.extrabold, fontSize: 30, marginTop: 10 }} color={colors.lime}>
            $
          </Txt>
          <TextInput
            value={amount ? num(amount) : ''}
            onChangeText={(v) => setAmount(parseInteger(v))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.onDarkFaint}
            accessibilityLabel={t('drv.withdraw.amountA11y')}
            style={[{ fontFamily: fonts.extrabold, fontSize: 56, letterSpacing: -2, color: colors.ivory, minWidth: 80, textAlign: 'center', fontVariant: ['tabular-nums'] }, { outlineStyle: 'none' } as object]}
          />
        </Row>
        {error ? (
          <Txt v="small" color={colors.danger} style={{ marginTop: 4 }} accessibilityLiveRegion="polite">
            {error}
          </Txt>
        ) : null}
        <Row style={{ gap: 8, marginTop: space[4] }}>
          {[0.25, 0.5, 1].map((p) => (
            <Chip key={p} tone="dark" label={p === 1 ? t('drv.withdraw.all') : `${p * 100} %`} active={amount === Math.floor((balance * p) / 1000) * 1000} onPress={() => setAmount(Math.floor((balance * p) / 1000) * 1000)} />
          ))}
        </Row>
      </View>

      <SectionHeader tone="dark" title={t('drv.withdraw.whereTitle')} style={{ marginTop: space[8] }} />
      {DESTS.map((x) => {
        const active = x.id === dest;
        return (
          <Tap key={x.id} onPress={() => setDest(x.id)} accessibilityState={{ selected: active }} style={{ marginBottom: 10 }}>
            <Row style={{ padding: 16, gap: 14, borderRadius: radius.lg, backgroundColor: colors.midnight700, borderWidth: 1.5, borderColor: active ? colors.lime : colors.lineDark }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: active ? colors.lime : colors.midnight600, alignItems: 'center', justifyContent: 'center' }}>
                <x.icon size={20} color={active ? colors.midnight : colors.ivory} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong" color={colors.ivory}>
                  {x.label}
                </Txt>
                <Txt v="caption" color={colors.onDarkMuted}>
                  {x.detail}
                </Txt>
              </View>
              {x.instant ? (
                <Row style={{ gap: 4 }}>
                  <Zap size={12} color={colors.lime} />
                  <Txt v="caption" color={colors.lime}>
                    {t('drv.withdraw.instant')}
                  </Txt>
                </Row>
              ) : (
                <Txt v="caption" color={colors.onDarkMuted}>
                  {t('drv.withdraw.oneDay')}
                </Txt>
              )}
            </Row>
          </Tap>
        );
      })}
      <Card tone="dark" style={{ marginTop: space[2] }}>
        <KeyValue tone="dark" label={t('drv.withdraw.amount')} value={cop(amount)} />
        <KeyValue tone="dark" label={t('drv.withdraw.fee')} value="$0" hint={t('drv.withdraw.feeHint')} />
        <Divider tone="dark" style={{ marginVertical: 6 }} />
        <KeyValue tone="dark" label={t('drv.withdraw.youGet')} value={cop(amount)} strong valueColor={colors.lime} />
      </Card>

      <SectionHeader tone="dark" title={t('drv.withdraw.recent')} style={{ marginTop: space[6] }} />
      {withdrawals.map((w) => (
        <Row key={w.id} style={{ paddingVertical: 10, gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Txt v="smallStrong" color={colors.ivory}>
              {w.destination}
            </Txt>
            <Txt v="caption" color={colors.onDarkMuted}>
              {dayLabel(w.date)}
            </Txt>
          </View>
          <Badge label={w.status === 'completado' ? t('drv.withdraw.completed') : t('drv.wallet.processing')} tone={w.status === 'completado' ? 'ghostDark' : 'lime'} />
          <Txt v="smallStrong" color={colors.ivory} tabular style={{ minWidth: 90, textAlign: 'right' }}>
            {cop(w.amount)}
          </Txt>
        </Row>
      ))}
    </Screen>
  );
}
