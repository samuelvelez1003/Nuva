import React, { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, Gift, Info, ShieldCheck, SlidersHorizontal } from 'lucide-react-native';
import { calculateFare, commissionText } from '../../lib/fare';
import { useNuvaSettings } from '../../lib/settings';
import { useCountry } from '../../lib/country';
import { useT } from '../../i18n';
import { Button } from '../../components/ui/Button';
import { Badge, Card, Chip, Divider, EmptyState, Row, SectionHeader } from '../../components/ui/primitives';
import { Header, Screen, useToast } from '../../components/ui/Screen';
import { Money, Txt } from '../../components/ui/Txt';
import { cop, dayLabel } from '../../lib/format';
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
  const [amount, setAmount] = useState(50_000);
  // Top-up options respect the admin's minimum (the server enforces it too).
  const amounts = Array.from(new Set([settings.minTopup, ...PRESETS.filter((a) => a > settings.minTopup)])).slice(0, 4);
  const chosen = Math.max(amount, settings.minTopup);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.rpc('driver_wallet');
    if (data) setWallet(data as DriverWallet);
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
  // "Average trip" = the same reference the website uses: NÜVA Go, 5 km · 15 min, current rates.
  const sample = calculateFare({ distanceKm: 5, durationMin: 15 }, pricing, 'go');
  const tripsLeft = Math.floor(balance / Math.max(1, sample.platformCommission));

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
            : low
            ? t('drv.wallet.low')
            : t('drv.wallet.enough', { n: tripsLeft, fare: cop(sample.finalFare), commission: cop(sample.platformCommission) })}
        </Txt>
      </View>

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
            const Icon = m.kind === 'comision' ? ArrowUpRight : m.kind === 'bono' ? Gift : m.kind === 'ajuste' ? SlidersHorizontal : ArrowDownLeft;
            const label =
              m.kind === 'comision'
                ? t('drv.wallet.mvCommission', { code: m.code ?? '' }).trim()
                : m.kind === 'bono'
                  ? t('drv.wallet.mvWelcome')
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
                  {m.status !== 'pagado' ? <Badge label={m.status === 'pendiente' ? t('drv.wallet.processing') : t('drv.wallet.failed')} tone={m.status === 'pendiente' ? 'warning' : 'danger'} /> : null}
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
          body={settings.welcomeBonus > 0 ? t('drv.wallet.emptyBonus', { amount: cop(settings.welcomeBonus) }) : t('drv.wallet.emptyBody')}
        />
      )}
    </Screen>
  );
}
