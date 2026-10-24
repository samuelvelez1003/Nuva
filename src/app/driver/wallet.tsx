import React, { useCallback, useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, BadgePercent, Banknote, CalendarCheck, CreditCard, Gift, Info, ShieldCheck, SlidersHorizontal, Ticket, UserX, Zap } from 'lucide-react-native';
import { calculateFare, commissionText } from '../../lib/fare';
import { useNuvaSettings } from '../../lib/settings';
import { useCountry } from '../../lib/country';
import { TKey, useT } from '../../i18n';
import { Button } from '../../components/ui/Button';
import { Badge, Card, Chip, Divider, EmptyState, Row, SectionHeader } from '../../components/ui/primitives';
import { Header, Screen, useToast } from '../../components/ui/Screen';
import { Money, Txt } from '../../components/ui/Txt';
import { SavedCards } from '../../components/wallet/SavedCards';
import { PAYOUT_LABEL, WithdrawSheet } from '../../components/driver/WithdrawSheet';
import { clock, cop, dayLabel, pct } from '../../lib/format';
import { buyPass, CommissionRule, driverFare, fetchCommissionRule } from '../../lib/commission';
import { DriverWallet, startTopup } from '../../lib/useDriverLive';
import { SavedCard, topUpWithSavedCard, wompiConfig } from '../../lib/wompi';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../store/AppStore';
import { colors, radius, space } from '../../theme/tokens';

const PRESETS = [20_000, 50_000, 100_000, 200_000];

/** Withdrawal states (wallet movements). */
const WD_STATUS: Record<string, { label: TKey; tone: 'warning' | 'lime' | 'danger' }> = {
  procesando: { label: 'drv2.wd.stProcessing', tone: 'warning' },
  completado: { label: 'drv2.wd.stPaid', tone: 'lime' },
  rechazado: { label: 'drv2.wd.stRejected', tone: 'danger' },
};


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
  const [buyingPass, setBuyingPass] = useState<'day' | 'week' | null>(null);
  const [amount, setAmount] = useState(50_000);
  // One-tap top-up with a saved card (needs Wompi's private key on the server).
  const [instant, setInstant] = useState(false);
  const [card, setCard] = useState<SavedCard | null>(null);
  const [charging, setCharging] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  useEffect(() => {
    wompiConfig()
      .then((c) => setInstant(c.savedCards))
      .catch(() => undefined);
  }, []);
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

  /** Charges the chosen saved card; Wompi answers in seconds and the balance is credited at once. */
  const rechargeWithCard = async () => {
    if (!card) return;
    setCharging(true);
    try {
      const r = await topUpWithSavedCard(chosen, card.id);
      if (r.paid) toast(t('drv2.topup.done', { amount: cop(chosen) }), 'success');
      else if (r.status === 'PENDING') toast(t('drv2.topup.pending'), 'info');
      else toast(r.error || t('drv2.topup.declined'), 'warning');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : t('drv.wallet.topUpError'), 'warning');
    } finally {
      setCharging(false);
    }
  };

  const purchasePass = async (kind: 'day' | 'week') => {
    setBuyingPass(kind);
    try {
      await buyPass(kind);
      toast(kind === 'day' ? t('drv2.pass.dayBought') : t('drv.wallet.passBought'), 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : t('common.somethingWrong'), 'warning');
    } finally {
      setBuyingPass(null);
    }
  };

  const balance = wallet?.balance ?? 0;
  const withdrawable = wallet?.withdrawable ?? rule?.withdrawable ?? 0;
  const minWithdrawal = rule?.minWithdrawal ?? settings.minWithdrawal;
  // One withdrawal at a time: the server refuses a second while one is being paid.
  const pendingWithdrawal = wallet?.movements.find((m) => m.kind === 'retiro' && m.status === 'procesando');
  const passes = rule
    ? ([
        rule.dayPassEnabled ? { kind: 'day' as const, price: rule.dayPassPrice } : null,
        rule.passEnabled ? { kind: 'week' as const, price: rule.passPrice } : null,
      ].filter(Boolean) as { kind: 'day' | 'week'; price: number }[])
    : [];
  const low = balance < settings.lowBalance;
  // "Average trip" = the same reference the website uses: NÜVA Go, 5 km · 15 min, current
  // rates — with this driver's own commission (free trips, volume rate).
  const sample = driverFare(calculateFare({ distanceKm: 5, durationMin: 15 }, pricing, 'go'), rule);
  const room = balance + (rule?.debtAllowance ?? 0);
  const tripsLeft = sample.platformCommission > 0 ? Math.max(0, Math.floor(room / sample.platformCommission)) : null;
  // Quick top-up: enough for ~10 more average trips, rounded up to 10.000 (and ≥ the minimum).
  const suggested =
    tripsLeft !== null && tripsLeft < 10
      ? Math.max(settings.minTopup, Math.ceil((10 * sample.platformCommission - Math.max(0, room)) / 10_000) * 10_000)
      : 0;

  return (
    <Screen bg={colors.midnight} header={<Header title={t('drv.wallet.title')} tone="dark" />}>
      <View style={{ padding: space[5], borderRadius: radius.xl, backgroundColor: low ? 'rgba(255,143,143,0.14)' : colors.midnight700, borderWidth: 1, borderColor: low ? 'rgba(255,143,143,0.5)' : colors.lineDarkStrong }}>
        <Txt v="overline" color={colors.onDarkMuted}>
          {t('drv.wallet.available')}
        </Txt>
        <Money value={cop(balance)} size={48} color={colors.ivory} signColor={colors.limeOnDark} style={{ marginTop: 6 }} />
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
            <BadgePercent size={16} color={colors.limeOnDark} />
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
            <Txt v="small" color={rule.challengeActive ? colors.limeOnDark : colors.onDarkMuted}>
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

      {/* Passes: no commission for 24 hours (daily) or 7 days (weekly), paid from the balance. */}
      {rule && !wallet?.test && rule.freeLeft === 0 && (passes.length || rule.passActive) ? (
        <Card tone="dark" style={{ marginTop: space[4], gap: 10 }}>
          <Row style={{ gap: 8 }}>
            <CalendarCheck size={16} color={colors.limeOnDark} />
            <Txt v="bodyStrong" color={colors.ivory}>
              {t('drv2.pass.title')}
            </Txt>
          </Row>
          {rule.passActive && rule.passEndsAt ? (
            <Txt v="small" color={colors.limeOnDark}>
              {t('drv2.pass.active', {
                pass: rule.passKind === 'day' ? t('drv2.pass.day') : t('drv.wallet.passTitle'),
                date: `${dayLabel(new Date(rule.passEndsAt))} ${clock(new Date(rule.passEndsAt))}`,
              })}
            </Txt>
          ) : (
            <>
              <Txt v="small" color={colors.onDarkMuted}>
                {t('drv2.pass.body')}
              </Txt>
              {passes.map((p) => (
                <Row key={p.kind} style={{ gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.midnight600 }}>
                  <View style={{ flex: 1 }}>
                    <Txt v="smallStrong" color={colors.ivory}>
                      {p.kind === 'day' ? t('drv2.pass.day') : t('drv.wallet.passTitle')} · {cop(p.price)}
                    </Txt>
                    <Txt v="caption" color={colors.onDarkMuted}>
                      {p.kind === 'day' ? t('drv2.pass.dayMeans') : t('drv2.pass.weekMeans')}
                    </Txt>
                  </View>
                  <Button
                    label={t('drv2.pass.buy')}
                    variant="primary"
                    size="sm"
                    full={false}
                    loading={buyingPass === p.kind}
                    disabled={!!buyingPass || balance < p.price}
                    onPress={() => purchasePass(p.kind)}
                  />
                </Row>
              ))}
              {passes.some((p) => balance < p.price) ? (
                <Txt v="caption" color={colors.onDarkFaint}>
                  {t('drv2.pass.needBalance')}
                </Txt>
              ) : null}
            </>
          )}
        </Card>
      ) : null}

      <Row style={{ gap: 10, alignItems: 'flex-start', marginTop: space[4], padding: 14, borderRadius: radius.md, backgroundColor: colors.limeDim }}>
        <Info size={16} color={colors.limeOnDark} style={{ marginTop: 2 }} />
        <Txt v="small" color={colors.onDark} style={{ flex: 1 }}>
          {t('drv.wallet.info', { payments: country.web.paymentNames.join(', '), commission: commissionText(pricing) })}
        </Txt>
      </Row>

      <SectionHeader tone="dark" title={t('drv.wallet.topUp')} style={{ marginTop: space[6] }} />
      <Row style={{ flexWrap: 'wrap', gap: 8 }}>
        {amounts.map((a) => (
          <Chip key={a} tone="dark" label={cop(a)} active={chosen === a} onPress={() => setAmount(a)} />
        ))}
      </Row>
      {instant ? (
        <>
          {/* Saved cards: pick one and top up with one tap (credited at once). */}
          <SavedCards tone="dark" title={t('drv2.topup.cardsTitle')} selectedId={card?.id} onSelect={setCard} onCardsChange={(list) => setCard((cur) => list.find((c) => c.id === cur?.id) ?? list[0] ?? null)} />
          {card ? (
            <Button
              label={t('drv2.topup.oneTap', { amount: cop(chosen), card: `•••• ${card.last4 ?? '····'}` })}
              icon={Zap}
              loading={charging}
              disabled={loading}
              onPress={rechargeWithCard}
              style={{ marginTop: space[4] }}
            />
          ) : null}
          <Button
            label={t('drv2.topup.other')}
            variant={card ? 'outlineDark' : 'primary'}
            size={card ? 'md' : 'lg'}
            loading={loading}
            disabled={charging}
            onPress={recharge}
            style={{ marginTop: card ? 10 : space[4] }}
          />
        </>
      ) : (
        <Button label={t('drv.wallet.topUpWith', { amount: cop(chosen) })} loading={loading} onPress={recharge} style={{ marginTop: space[4] }} />
      )}
      <Row style={{ gap: 6, marginTop: 10, justifyContent: 'center' }}>
        <ShieldCheck size={13} color={colors.onDarkFaint} />
        <Txt v="caption" color={colors.onDarkFaint}>
          {t('drv.wallet.securePay')}
        </Txt>
      </Row>

      {/* Withdrawals: what NÜVA collected for the driver (card trips, cancellations, promotions). */}
      {rule && !wallet?.test ? (
        <>
          <SectionHeader tone="dark" title={t('drv2.wd.title')} style={{ marginTop: space[8] }} />
          <Card tone="dark" style={{ gap: 10 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Txt v="caption" color={colors.onDarkMuted}>
                  {t('drv2.wd.available')}
                </Txt>
                <Money value={cop(withdrawable)} size={32} color={colors.ivory} signColor={colors.limeOnDark} />
              </View>
              <Banknote size={22} color={colors.limeOnDark} />
            </Row>
            <Txt v="small" color={colors.onDarkMuted}>
              {t('drv2.wd.what')}
            </Txt>
            {pendingWithdrawal ? (
              <Txt v="smallStrong" color={colors.warning}>
                {t('drv2.wd.inProgress', { amount: cop(-pendingWithdrawal.amount) })}
              </Txt>
            ) : null}
            <Button
              label={t('drv2.wd.cta')}
              variant="outlineDark"
              size="md"
              disabled={!!pendingWithdrawal || withdrawable < minWithdrawal}
              onPress={() => setWithdrawing(true)}
            />
            <Txt v="caption" color={colors.onDarkFaint}>
              {withdrawable < minWithdrawal ? t('drv2.wd.belowMin', { min: cop(minWithdrawal) }) : t('drv2.wd.sameDay')}
            </Txt>
          </Card>
          {withdrawing ? (
            <WithdrawSheet
              visible
              withdrawable={withdrawable}
              minWithdrawal={minWithdrawal}
              onClose={() => setWithdrawing(false)}
              onDone={() => {
                setWithdrawing(false);
                load();
              }}
            />
          ) : null}
        </>
      ) : null}

      <SectionHeader tone="dark" title={t('drv.wallet.movements')} style={{ marginTop: space[8] }} />
      {wallet && wallet.movements.length ? (
        <Card tone="dark" padded={false} style={{ paddingHorizontal: space[4] }}>
          {wallet.movements.map((m, i) => {
            const Icon =
              m.kind === 'comision' ? ArrowUpRight
              : m.kind === 'bono' ? Gift
              : m.kind === 'promo' ? Ticket
              : m.kind === 'pase' ? CalendarCheck
              : m.kind === 'cancelacion' ? UserX
              : m.kind === 'ajuste' ? SlidersHorizontal
              : m.kind === 'tarjeta' ? CreditCard
              : m.kind === 'retiro' ? Banknote
              : ArrowDownLeft;
            const wd = m.kind === 'retiro' ? WD_STATUS[m.status] : undefined;
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
                    ? (m.note === 'Pase diario' ? t('drv2.pass.day') : t('drv.wallet.mvPass'))
                    : m.kind === 'tarjeta'
                    ? t('drv2.mv.card', { code: (m.note ?? '').replace(/^Viaje con tarjeta\s*/, '') }).trim()
                    : m.kind === 'retiro'
                    ? t('drv2.mv.withdrawal', { method: m.method ? t(PAYOUT_LABEL[m.method] ?? 'drv2.wd.bank') : '' }).trim()
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
                  <Icon size={18} color={m.kind === 'comision' ? colors.onDarkMuted : colors.limeOnDark} />
                  <View style={{ flex: 1 }}>
                    <Txt v="smallStrong" color={colors.ivory}>
                      {label}
                    </Txt>
                    <Txt v="caption" color={colors.onDarkFaint}>
                      {dayLabel(new Date(m.at))}
                    </Txt>
                    {/* The team's note on a withdrawal: payment reference, or why it was rejected. */}
                    {m.kind === 'retiro' && m.note ? (
                      <Txt v="caption" color={m.status === 'rechazado' ? colors.dangerOnDark : colors.onDarkMuted}>
                        {m.note}
                      </Txt>
                    ) : null}
                  </View>
                  {wd ? (
                    <Badge label={t(wd.label)} tone={wd.tone} />
                  ) : m.status !== 'pagado' ? (
                    <Badge
                      label={m.status === 'pendiente' ? t('drv.wallet.processing') : m.status === 'vencido' ? t('drv.wallet.expired') : t('drv.wallet.failed')}
                      tone={m.status === 'pendiente' ? 'warning' : m.status === 'vencido' ? 'neutral' : 'danger'}
                    />
                  ) : null}
                  {/* A rejected withdrawal never left the balance. */}
                  <Txt
                    v="smallStrong"
                    tabular
                    color={m.status === 'rechazado' ? colors.onDarkFaint : m.amount < 0 ? colors.onDark : colors.limeOnDark}
                    style={m.status === 'rechazado' ? { textDecorationLine: 'line-through' } : undefined}
                  >
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
