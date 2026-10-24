import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Info, Wallet } from 'lucide-react-native';
import { useAuth } from '../../../store/Auth';
import { categoryCommission } from '../../../lib/fare';
import { useCountry } from '../../../lib/country';
import { useT } from '../../../i18n';
import { BarChart } from '../../../components/charts/Charts';
import { Button } from '../../../components/ui/Button';
import { Card, Divider, KeyValue, Row, SectionHeader, Segmented } from '../../../components/ui/primitives';
import { Header, Screen } from '../../../components/ui/Screen';
import { Money, Txt } from '../../../components/ui/Txt';
import { clock, cop, copCompact, decimal, km, weekdayShort } from '../../../lib/format';
import { dailySeries, startOfWeek, sumTrips, todayTrips, tripsSince, useApp, weekSeries } from '../../../store/AppStore';
import { colors, radius, space } from '../../../theme/tokens';
import { DriverSummary, fetchDriverSummary } from '../../../lib/liveTrips';

/** Live: this week's real totals from the server (Monday to today). */
function WeeklySummary() {
  const t = useT();
  const [s, setS] = useState<DriverSummary | null>(null);
  useEffect(() => {
    const days = ((new Date().getDay() + 6) % 7) + 1;
    fetchDriverSummary(days)
      .then(setS)
      .catch(() => {});
  }, []);
  if (!s) return null;
  return (
    <Card tone="dark" style={{ marginTop: space[5], gap: 4 }}>
      <Txt v="bodyStrong" color={colors.ivory} style={{ marginBottom: 6 }}>
        {t('drv.earnings.weekSummary')}
      </Txt>
      <KeyValue tone="dark" label={t('drv.earnings.wsTrips')} value={String(s.trips)} />
      <KeyValue tone="dark" label={t('drv.earnings.wsGross')} value={cop(s.gross)} />
      {s.surcharges > 0 ? <KeyValue tone="dark" label={t('drv.earnings.wsSurcharges')} value={cop(s.surcharges)} /> : null}
      <KeyValue tone="dark" label={t('drv.earnings.wsCommission')} value={`−${cop(s.commission)}`} />
      {s.tips > 0 ? <KeyValue tone="dark" label={t('drv.earnings.wsTips')} value={`+${cop(s.tips)}`} /> : null}
      {s.waits > 0 ? <KeyValue tone="dark" label={t('drv.earnings.wsWaits')} value={cop(s.waits)} /> : null}
      {s.cancelFees > 0 ? <KeyValue tone="dark" label={t('drv.earnings.wsCancel')} value={`+${cop(s.cancelFees)}`} /> : null}
      <Divider tone="dark" />
      <KeyValue tone="dark" label={t('drv.earnings.wsNet')} value={cop(s.net)} />
      {s.freeTrips > 0 ? (
        <Txt v="caption" color={colors.lime} style={{ marginTop: 4 }}>
          {t('drv.earnings.wsFree', { n: s.freeTrips })}
        </Txt>
      ) : null}
    </Card>
  );
}

type Range = 'day' | 'week' | 'month';

export default function DriverEarnings() {
  const { driverTrips, pricing } = useApp();
  // Passengers pay the driver directly: there are no payouts, only the prepaid balance for commissions.
  const isLive = useAuth().live;
  const { country } = useCountry();
  const t = useT();
  const [range, setRange] = useState<Range>('week');
  const [sel, setSel] = useState<number | undefined>();

  const now = new Date();
  const trips = useMemo(
    () => (range === 'day' ? todayTrips(driverTrips) : range === 'week' ? tripsSince(driverTrips, startOfWeek()) : tripsSince(driverTrips, new Date(now.getTime() - 29 * 86_400_000))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [driverTrips, range],
  );
  const s = sumTrips(trips);
  // Effective rate actually charged on these trips (each trip keeps the % it was priced with).
  const ratePct = s.gross ? (s.commission / s.gross) * 100 : categoryCommission(pricing, 'go');

  const chart =
    range === 'week'
      ? weekSeries(driverTrips).map((d) => ({ label: weekdayShort(d.date), value: d.net, highlight: d.date.toDateString() === now.toDateString(), muted: d.future }))
      : range === 'month'
        ? dailySeries(driverTrips, 30).map((d, i, a) => ({ label: i % 5 === 0 || i === a.length - 1 ? `${d.date.getDate()}` : '', value: d.net, highlight: i === a.length - 1 }))
        : // Day: net per 2-hour block
          Array.from({ length: 8 }, (_, i) => {
            const from = 6 + i * 2;
            const v = trips.filter((t) => t.date.getHours() >= from && t.date.getHours() < from + 2).reduce((a, t) => a + t.fare.driverEarnings, 0);
            return { label: `${from}h`, value: v, highlight: now.getHours() >= from && now.getHours() < from + 2 };
          });

  const label = range === 'day' ? t('drv.earnings.today') : range === 'week' ? t('drv.earnings.thisWeek') : t('drv.earnings.last30');

  return (
    <Screen bg={colors.midnight} header={<Header title={t('drv.earnings.title')} back={false} large tone="dark" />} contentStyle={{ paddingBottom: 140 }}>
      <Segmented
        tone="dark"
        value={range}
        onChange={(v) => {
          setRange(v);
          setSel(undefined);
        }}
        options={[
          { value: 'day', label: t('drv.earnings.day') },
          { value: 'week', label: t('drv.earnings.week') },
          { value: 'month', label: t('drv.earnings.month') },
        ]}
      />

      {isLive ? <WeeklySummary /> : null}

      <Animated.View key={range} entering={FadeIn.duration(250)}>
        <View style={{ marginTop: space[6] }}>
          <Txt v="overline" color={colors.onDarkMuted}>
            {t('drv.earnings.netLabel', { period: label })}
          </Txt>
          <Money value={cop(s.net)} size={52} color={colors.ivory} signColor={colors.lime} style={{ marginTop: 6 }} />
          <Txt v="small" color={colors.onDarkMuted}>
            {t('drv.earnings.summary', { count: s.count, km: km(s.km), hours: decimal(s.minutes / 60, 1) })}
          </Txt>
        </View>

        <Card tone="dark" style={{ marginTop: space[5] }}>
          <BarChart data={chart} format={copCompact} selected={sel} onSelect={(i) => setSel(sel === i ? undefined : i)} height={120} />
        </Card>

        {/* Commission breakdown */}
        <SectionHeader tone="dark" title={t('drv.earnings.breakdown')} style={{ marginTop: space[6] }} />
        <Card tone="dark">
          <KeyValue tone="dark" label={t('common.chargedToPassengers')} value={cop(s.gross)} />
          <KeyValue tone="dark" label={t('common.nuvaCommissionPct', { pct: decimal(ratePct, Number.isInteger(ratePct) ? 0 : 1) })} value={`−${cop(s.commission)}`} hint={t('drv.earnings.commissionHint')} />
          <Divider tone="dark" style={{ marginVertical: 8 }} />
          <KeyValue tone="dark" label={t('common.netEarnings')} value={cop(s.net)} strong valueColor={colors.lime} />
          <Row style={{ height: 10, borderRadius: 5, overflow: 'hidden', gap: 3, marginTop: space[3] }}>
            <View style={{ flex: s.net || 1, height: 10, backgroundColor: colors.lime, borderRadius: 5 }} />
            <View style={{ flex: s.commission || 0.01, height: 10, backgroundColor: colors.midnight400, borderRadius: 5 }} />
          </Row>
          <View style={{ marginTop: space[4], padding: 14, borderRadius: radius.md, backgroundColor: colors.limeDim, flexDirection: 'row', gap: 10 }}>
            <Info size={16} color={colors.lime} style={{ marginTop: 2 }} />
            <Txt v="small" color={colors.onDark} style={{ flex: 1 }}>
              {t('drv.earnings.lockInfo')}{' '}
              <Txt v="smallStrong" color={colors.lime}>
                {t('drv.earnings.tipsYours')}
              </Txt>
            </Txt>
          </View>
        </Card>

        {range === 'day' && trips.length ? (
          <>
            <SectionHeader tone="dark" title={t('drv.earnings.todayTrips')} style={{ marginTop: space[5] }} />
            <Card tone="dark" padded={false} style={{ paddingHorizontal: space[4] }}>
              {trips.map((trip, i) => (
                <View key={trip.id}>
                  {i ? <Divider tone="dark" /> : null}
                  <Row style={{ paddingVertical: 12, gap: 12 }}>
                    <Txt v="caption" color={colors.onDarkFaint} tabular style={{ width: 62 }}>
                      {clock(trip.date)}
                    </Txt>
                    <Txt v="small" color={colors.onDark} style={{ flex: 1 }} numberOfLines={1}>
                      {trip.to.name}
                    </Txt>
                    <Txt v="smallStrong" color={colors.lime} tabular>
                      +{cop(trip.fare.driverEarnings)}
                    </Txt>
                  </Row>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </Animated.View>

      <Card tone="raised" style={{ marginTop: space[6] }}>
        <Txt v="small" color={colors.onDarkMuted}>
          {t('drv.earnings.liveInfo', { payments: country.web.paymentNames.join(', ') })}
        </Txt>
        <Button label={t('drv.earnings.seeWallet')} icon={Wallet} size="md" style={{ marginTop: space[4] }} onPress={() => router.push('/driver/wallet')} />
      </Card>
    </Screen>
  );
}
