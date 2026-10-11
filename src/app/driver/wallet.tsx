import React, { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, BadgePercent, CalendarCheck, Gift, Info, ShieldCheck, SlidersHorizontal, Ticket, UserX } from 'lucide-react-native';
import { calculateFare, commissionText } from '../../lib/fare';
import { useNuvaSettings } from '../../lib/settings';
import { useCountry } from '../../lib/country';
import { useT } from '../../i18n';
import { Button } from '../../components/ui/Button';
import { Badge, Card, Chip, Divider, EmptyState, Row, SectionHeader } from '../../components/ui/primitives';
import { Header, Screen, useToast } from '../../components/ui/Screen';
import { Money, Txt } from '../../components/ui/Txt';
import { cop, dayLabel, pct } from '../../lib/format';
import { buyWeeklyPass, CommissionRule, driverFare, fetchCommissionRule } from '../../lib/commission';
import { DriverWallet, startTopup } from '../../lib/useDriverLive';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../store/AppStore';
import { colors, radius, space } from '../../theme/tokens';

const PRESETS = [20_000, 50_000, 100_000, 200_000];


/**
 * Prepaid NÜVA balance. Passengers pay drivers directly; every completed trip
 * automatically deducts the platform commission from this balance.
 */
export default function DriverWalletScreen() {
  const toast = useToast();
  const t = useT();
  const { pricing } = useApp();
  const { settings } = useNuvaSettings();
  const { country } = useCountry();
  const [wallet, setWallet] = useState<DriverWallet | null>(null);
  const [rule, setRule] = useState<CommissionRule | null>(null);
  const [buyingPass, setBuyingPass] = useState(false);
  const [amount, setAmount] = useState(50_000);
  // Top-up options respect the admin's minimum (the server enforces it too).
  const amounts = Array.from(new Set([settings.minTopup, ...PRESETS.filter((a) => a > settings.minTopup)])).slice(0, 4);
  const chosen = Math.max(amount, settings.minTopup);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [{ data }, r] = await Promise.all([supabase.rpc('driver_wallet'), fetchCommissionRule()]);
    if (data) setWallet(data as DriverWallet);
    setRule(r);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const recharge = async () => {
    setLoading(true);
    try {
      const url = await startTopup(chosen);
      await Linking.openURL(url);
      toast(t('drv.wallet.completeInWompi'), 'info');
    } catch (e) {
      toast(e instanceof Error ? e.message : t('drv.wallet.topUpError'), 'warning');
    } finally {
      setLoading(false);
    }
  };

  const balance = wallet?.balance ?? 0;
  const low = balance < settings.lowBalance;
  // "Average trip" = the same reference the website uses: NÜVA Go, 5 km · 15 min, current
  // rates — with this driver's own commission (free trips, volume rate).
  const sample = driverFare(calculateFare({ distanceKm: 5, durationMin: 15 }, pricing, 'go'), rule);
  const room = balance + (rule?.debtAllowance ?? 0);
  const tripsLeft = sample.platformCommission > 0 ? Math.max(0, Math.floor(room / sample.platformCommission)) : null;
  // Quick top-up: enough for ~10 more average trips, rounded up to 10.000 (and ≥ the minimum).
  const suggested =
    tripsLeft !== null && tripsLeft < 10 && country.topup === 'wompi'
      ? Math.max(settings.minTopup, Math.ceil((10 * sample.platformCommission - Math.max(0, room)) / 10_000) * 10_000)
      : 0;

  return (
    <Screen bg={colors.midnight} header={<Header title={t('drv.wallet.title')} tone="dark" />}>
      <View style={{ padding: space[5], borderRadius: radius.xl, backgroundColor: low ? 'rgba(255,91,74,0.14)' : colors.midnight700, borderWidth: 1, borderColor: low ? 'rgba(255,91,74,0.5)' : colors.lineDarkStrong }}>
        <Txt v="overline" color={colors.onDarkMuted}>
          {t('drv.wallet.available')}
        </Txt>
        <Money value={cop(balance)} size={48} color={colors.ivory} signColor={colors.lime} style={{ marginTop: 6 }} />
        <Txt v="small" color={colors.onDarkMuted}>
          {wallet?.test
            ? t('drv.wallet.testBalance')
            : tripsLeft === null
            ? t('drv.wallet.freeNow')
            : low
            ? t('drv.wallet.low')
            : t('drv.wallet.enough', { n: tripsLeft, fare: cop(sample.finalFare), commission: cop(sample.platformCommission) })}
        </Txt>
        {suggested && !wallet?.test ? (
          <Chip tone="dark" active icon={Ticket} label={t('drv.wallet.suggest', { amount: cop(suggested) })} onPress={() => setAmount(suggested)} style={{ marginTop: space[3], alignSelf: 'flex-start' }} />
        ) : null}
      </View>

      {/* This driver's commission: free first trips, volume rate, surcharges always theirs. */}
      {rule && !wallet?.test ? (
        <Card tone="dark" style={{ marginTop: space[4], gap: 8 }}>
          <Row style={{ gap: 8 }}>
            <BadgePercent size={16} color={colors.lime} />
            <Txt v="bodyStrong" color={colors.ivory}>
              {t('drv.wallet.rulesTitle')}
            </Txt>
          </Row>
          <Txt v="small" color={colors.onDarkMuted}>
            {rule.freeLeft > 0
              ? t('drv.wallet.freeLeft', { n: rule.freeLeft })
              : rule.tierActive
                ? t('drv.wallet.tierActive', { pct: pct(rule.tierPct, 1) })
                : t('drv.wallet.tierProgress', { n: rule.monthTrips, total: rule.tierThreshold, pct: pct(rule.tierPct, 1) })}
          </Txt>
          {rule.freeLeft === 0 && !rule.passActive ? (
            <Txt v="small" color={rule.challengeActive ? colors.lime : colors.onDarkMuted}>
              {rule.challengeActive
                ? t('drv.wallet.challengeDone', { pct: pct(rule.challengePct, 1) })
                : t('drv.wallet.challenge', { n: rule.weekTrips, total: rule.challengeTrips, pct: pct(rule.challengePct, 1) })}
            </Txt>
          ) : null}
          <Txt v="caption" color={colors.onDarkFaint}>
            {t('drv.wallet.surchargesYours')}
            {rule.debtAllowance > 0 ? ` ${t('drv.wallet.debt', { amount: cop(rule.debtAllowance) })}` : ''}
          </Txt>
        </Card>
      ) : null}

      {/* Weekly pass: no commission for 7 days, paid from the balance. */}
      {rule && !wallet?.test && rule.passEnabled && rule.freeLeft === 0 ? (
        <Card tone="dark" style={{ marginTop: space[4], gap: 8 }}>
          <Row style={{ gap: 8 }}>
            <CalendarCheck size={16} color={colors.lime} />
            <Txt v="bodyStrong" color={colors.ivory}>
              {t('drv.wallet.passTitle')}
            </Txt>
          </Row>
          {rule.passActive && rule.passEndsAt ? (
            <Txt v="small" color={colors.lime}>
              {t('drv.wallet.passActive', { date: dayLabel(new Date(rule.passEndsAt)) })}
            </Txt>
          ) : (
            <>
              <Txt v="small" color={colors.onDarkMuted}>
                {t('drv.wallet.passBody', { price: cop(rule.passPrice) })}
              </Txt>
              <Button
                label={t('drv.wallet.passBuy', { price: cop(rule.passPrice) })}
                variant="outline"
                size="md"
                loading={buyingPass}
                disabled={balance < rule.passPrice}
                onPress={async () => {
                  setBuyingPass(true);
                  try {
                    await buyWeeklyPass();
                    toast(t('drv.wallet.passBought'), 'success');
                    load();
                  } catch (e) {
                    toast(e instanceof Error ? e.message : t('common.somethingWrong'), 'warning');
                  } finally {
                    setBuyingPass(false);
                  }
                }}
              />
            </>
          )}
        </Card>
      ) : null}

      <Row style={{ gap: 10, alignItems: 'flex-start', marginTop: space[4], padding: 14, borderRadius: radius.md, backgroundColor: colors.limeDim }}>
        <Info size={16} color={colors.lime} style={{ marginTop: 2 }} />
        <Txt v="small" color={colors.onDark} style={{ flex: 1 }}>
          {t('drv.wallet.info', { payments: country.web.paymentNames.join(', '), commission: commissionText(pricing) })}
        </Txt>
      </Row>

      <SectionHeader tone="dark" title={t('drv.wallet.topUp')} style={{ marginTop: space[6] }} />
      {country.topup === 'wompi' ? (
        <>
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            {amounts.map((a) => (
              <Chip key={a} tone="dark" label={cop(a)} active={chosen === a} onPress={() => setAmount(a)} />
            ))}
          </Row>
          <Button label={t('drv.wallet.topUpWith', { amount: cop(chosen) })} loading={loading} onPress={recharge} style={{ marginTop: space[4] }} />
          <Row style={{ gap: 6, marginTop: 10, justifyContent: 'center' }}>
            <ShieldCheck size={13} color={colors.onDarkFaint} />
            <Txt v="caption" color={colors.onDarkFaint}>
              {t('drv.wallet.securePay')}
            </Txt>
          </Row>
        </>
      ) : (
        // Curaçao: no card gateway yet — top-ups are credited by NÜVA from the admin console.
        <Card tone="dark" style={{ gap: 8 }}>
          <Txt v="bodyStrong" color={colors.ivory}>
            {t('drv.wallet.manualTitle', { country: country.name })}
          </Txt>
          <Txt v="small" color={colors.onDarkMuted}>
            {t('drv.wallet.manualBody', { min: cop(settings.minTopup) })}
          </Txt>
        </Card>
      )}

      <SectionHeader tone="dark" title={t('drv.wallet.movements')} style={{ marginTop: space[8] }} />
      {wallet && wallet.movements.length ? (
        <Card tone="dark" padded={false} style={{ paddingHorizontal: space[4] }}>
          {wallet.movements.map((m, i) => {
            const Icon =
              m.kind === 'comision' ? ArrowUpRight : m.kind === 'bono' ? Gift : m.kind === 'promo' ? Ticket : m.kind === 'pase' ? CalendarCheck : m.kind === 'cancelacion' ? UserX : m.kind === 'ajuste' ? SlidersHorizontal : ArrowDownLeft;
            const ruleNote =
              m.rule === 'free' ? ` · ${t('drv.wallet.mvFree')}`
              : m.rule === 'tier' ? ` · ${t('drv.wallet.mvTier')}`
              : m.rule === 'pass' ? ` · ${t('drv.wallet.mvPassRule')}`
              : m.rule === 'challenge' ? ` · ${t('drv.wallet.mvChallenge')}`
              : '';
            const label =
              m.kind === 'comision'
                ? `${t('drv.wallet.mvCommission', { code: m.code ?? '' }).trim()}${ruleNote}`
                : m.kind === 'bono'
                  ? t('drv.wallet.mvWelcome')
                  : m.kind === 'pase'
                    ? t('drv.wallet.mvPass')
                    : m.kind === 'cancelacion'
                    ? t('drv.wallet.mvCancel')
                    : m.kind === 'promo'
                    ? `${t('drv.wallet.mvPromo')}${m.note ? ` · ${m.note.replace(/^Promoción\s*/, '')}` : ''}`
                    : m.kind === 'ajuste'
                      ? `${t('drv.wallet.mvAdjust')}${m.note ? ` · ${m.note}` : ''}`
                      : t('drv.wallet.mvTopUp');
            return (
              <View key={`${m.at}-${i}`}>
                {i ? <Divider tone="dark" /> : null}
                <Row style={{ paddingVertical: 12, gap: 12 }}>
                  <Icon size={18} color={m.kind === 'comision' ? colors.onDarkMuted : colors.lime} />
                  <View style={{ flex: 1 }}>
                    <Txt v="smallStrong" color={colors.ivory}>
                      {label}
                    </Txt>
                    <Txt v="caption" color={colors.onDarkFaint}>
                      {dayLabel(new Date(m.at))}
                    </Txt>
                  </View>
                  {m.status !== 'pagado' ? (
                    <Badge
                      label={m.status === 'pendiente' ? t('drv.wallet.processing') : m.status === 'vencido' ? t('drv.wallet.expired') : t('drv.wallet.failed')}
                      tone={m.status === 'pendiente' ? 'warning' : m.status === 'vencido' ? 'neutral' : 'danger'}
                    />
                  ) : null}
                  <Txt v="smallStrong" tabular color={m.amount < 0 ? colors.onDark : colors.lime}>
                    {m.amount < 0 ? `−${cop(-m.amount)}` : `+${cop(m.amount)}`}
                  </Txt>
                </Row>
              </View>
            );
          })}
        </Card>
      ) : (
        <EmptyState
          tone="dark"
          icon={Gift}
          title={t('drv.wallet.emptyTitle')}
          body={
            settings.freeTrips > 0
              ? t('drv.wallet.emptyFree', { n: settings.freeTrips })
              : settings.welcomeBonus > 0
                ? t('drv.wallet.emptyBonus', { amount: cop(settings.welcomeBonus) })
                : t('drv.wallet.emptyBody')
          }
        />
      )}
    </Screen>
  );
}
