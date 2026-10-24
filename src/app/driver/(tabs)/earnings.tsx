import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ChevronDown, Info, Route, Wallet } from 'lucide-react-native';
import { useAuth } from '../../../store/Auth';
import { categoryCommission } from '../../../lib/fare';
import { useCountry } from '../../../lib/country';
import { useT } from '../../../i18n';
import { BarChart } from '../../../components/charts/Charts';
import { FareBreakdownCard } from '../../../components/fare/FareBreakdownCard';
import { Button, Tap } from '../../../components/ui/Button';
import { Badge, Card, Divider, EmptyState, KeyValue, Row, SectionHeader, Segmented } from '../../../components/ui/primitives';
import { Header, Screen } from '../../../components/ui/Screen';
import { Money, Txt } from '../../../components/ui/Txt';
import { clock, cop, copCompact, dayLabel, decimal, km, weekdayShort } from '../../../lib/format';
import { paymentLabel } from '../../../data/mock';
import { dailySeries, DriverTrip, startOfWeek, sumTrips, todayTrips, tripsSince, useApp, weekSeries } from '../../../store/AppStore';
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
        <Txt v="caption" color={colors.limeOnDark} style={{ marginTop: 4 }}>
          {t('drv.earnings.wsFree', { n: s.freeTrips })}
        </Txt>
      ) : null}
    </Card>
  );
}

type Range = 'day' | 'week' | 'month';

/** What the driver kept on a trip: fare minus commission, plus the tip (100 % theirs). */
const tripNet = (trip: DriverTrip) => trip.fare.driverEarnings + (trip.tip ?? 0);
const PAGE = 40;

/** One trip of the log: time, route, code, payment and the money; tap for the full fare breakdown. */
function TripLogRow({ trip, open, onToggle }: { trip: DriverTrip; open: boolean; onToggle: () => void }) {
  const t = useT();
  const { pricing } = useApp();
  const from = trip.from.id === 'current' ? trip.from.address : trip.from.name;
  const net = tripNet(trip);
  const payment = trip.payment ? paymentLabel(trip.payment, t) : null;
  const status =
    trip.paymentStatus === 'fallido'
      ? { label: t('drv.earnings.payFailed'), tone: 'danger' as const }
      : trip.paymentStatus === 'pendiente' && trip.payment && trip.payment !== 'cash'
        ? { label: t('drv.earnings.payPending'), tone: 'warning' as const }
        : null;
  const money: [string, string][] = [
    [t('drv.earnings.logFare'), cop(trip.fare.finalFare)],
    [t('drv.earnings.logCommission'), `−${cop(trip.fare.platformCommission)}`],
    ...(trip.tip ? ([[t('drv.earnings.logTip'), `+${cop(trip.tip)}`]] as [string, string][]) : []),
  ];
  return (
    <View>
      <Tap
        onPress={onToggle}
        scaleTo={0.99}
        haptics={false}
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t('drv.earnings.logA11y', { time: clock(trip.date), from, to: trip.to.name, net: cop(net) })}
        accessibilityHint={t('drv.earnings.logShowDetail')}
        style={{ paddingVertical: 12, minHeight: 44, gap: 6 }}
      >
        <Row style={{ gap: 10 }}>
          <Txt v="caption" color={colors.onDarkFaint} tabular style={{ width: 48 }}>
            {clock(trip.date)}
          </Txt>
          <Txt v="smallStrong" color={colors.onDark} style={{ flex: 1 }} numberOfLines={1}>
            {from} → {trip.to.name}
          </Txt>
          <Txt v="bodyStrong" color={colors.limeOnDark} tabular>
            +{cop(net)}
          </Txt>
        </Row>
        <Row style={{ gap: 8, paddingLeft: 58 }}>
          <Txt v="caption" color={colors.onDarkMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
            {[trip.code, payment].filter(Boolean).join(' · ')}
          </Txt>
          {status ? <Badge label={status.label} tone={status.tone} /> : null}
          <View style={{ flex: 1 }} />
          <ChevronDown size={16} color={colors.onDarkFaint} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
        </Row>
        <Row style={{ gap: 14, paddingLeft: 58, flexWrap: 'wrap' }}>
          {money.map(([l, v]) => (
            <Txt key={l} v="caption" color={colors.onDarkFaint} tabular>
              {l}{' '}
              <Txt v="caption" color={colors.onDarkMuted} tabular>
                {v}
              </Txt>
            </Txt>
          ))}
        </Row>
      </Tap>
      {open ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ paddingBottom: space[4] }}>
          <FareBreakdownCard fare={trip.fare} config={pricing} audience="driver" tone="dark" compact />
          {trip.tip ? <KeyValue tone="dark" label={t('drv.earnings.logTip')} value={`+${cop(trip.tip)}`} valueColor={colors.limeOnDark} /> : null}
          <KeyValue tone="dark" label={t('drv.earnings.logNet')} value={cop(net)} strong valueColor={colors.limeOnDark} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** The period's trips, newest first, grouped by day (date + that day's net). */
function TripLog({ trips }: { trips: DriverTrip[] }) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const sorted = useMemo(() => [...trips].sort((a, b) => b.date.getTime() - a.date.getTime()), [trips]);
  // Per day: every trip of that day counts in its header (count and net), even beyond the page.
  const days = useMemo(() => {
    const m = new Map<string, { n: number; total: number }>();
    for (const x of sorted) {
      const k = x.date.toDateString();
      const d = m.get(k) ?? { n: 0, total: 0 };
      d.n += 1;
      d.total += tripNet(x);
      m.set(k, d);
    }
    return m;
  }, [sorted]);
  const groups = useMemo(() => {
    const out: { key: string; label: string; data: DriverTrip[] }[] = [];
    for (const trip of sorted.slice(0, limit)) {
      const key = trip.date.toDateString();
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: dayLabel(trip.date), data: [] };
        out.push(g);
      }
      g.data.push(trip);
    }
    return out;
  }, [sorted, limit]);

  if (!sorted.length) {
    return <EmptyState tone="dark" icon={Route} title={t('drv.earnings.logEmpty')} body={t('drv.earnings.logEmptyBody')} />;
  }
  const rest = sorted.length - limit;
  return (
    <View style={{ gap: space[4] }}>
      {groups.map((g) => {
        const d = days.get(g.key) ?? { n: g.data.length, total: 0 };
        return (
          <View key={g.key}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <Txt v="overline" color={colors.onDarkMuted}>
                {t(d.n === 1 ? 'drv.trips.dayHeaderOne' : 'drv.trips.dayHeader', { day: g.label, n: d.n })}
              </Txt>
              <Txt v="smallStrong" color={colors.limeOnDark} tabular>
                {cop(d.total)}
              </Txt>
            </Row>
            <Card tone="dark" padded={false} style={{ paddingHorizontal: space[4] }}>
              {g.data.map((trip, i) => (
                <View key={trip.id}>
                  {i ? <Divider tone="dark" /> : null}
                  <TripLogRow trip={trip} open={open === trip.id} onToggle={() => setOpen(open === trip.id ? null : trip.id)} />
                </View>
              ))}
            </Card>
          </View>
        );
      })}
      {rest > 0 ? (
        <Button label={t('drv.earnings.logMore', { n: Math.min(rest, PAGE) })} variant="outlineDark" size="md" onPress={() => setLimit((l) => l + PAGE)} />
      ) : null}
    </View>
  );
}

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
          <Money value={cop(s.net)} size={52} color={colors.ivory} signColor={colors.limeOnDark} style={{ marginTop: 6 }} />
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
          <KeyValue tone="dark" label={t('common.netEarnings')} value={cop(s.net)} strong valueColor={colors.limeOnDark} />
          {s.tips > 0 ? <KeyValue tone="dark" label={t('drv.earnings.logTips')} value={`+${cop(s.tips)}`} valueColor={colors.limeOnDark} /> : null}
          <Row style={{ height: 10, borderRadius: 5, overflow: 'hidden', gap: 3, marginTop: space[3] }}>
            <View style={{ flex: s.net || 1, height: 10, backgroundColor: colors.limeOnDark, borderRadius: 5 }} />
            <View style={{ flex: s.commission || 0.01, height: 10, backgroundColor: colors.midnight400, borderRadius: 5 }} />
          </Row>
          <View style={{ marginTop: space[4], padding: 14, borderRadius: radius.md, backgroundColor: colors.limeDim, flexDirection: 'row', gap: 10 }}>
            <Info size={16} color={colors.limeOnDark} style={{ marginTop: 2 }} />
            <Txt v="small" color={colors.onDark} style={{ flex: 1 }}>
              {t('drv.earnings.lockInfo')}{' '}
              <Txt v="smallStrong" color={colors.limeOnDark}>
                {t('drv.earnings.tipsYours')}
              </Txt>
            </Txt>
          </View>
        </Card>

        {/* Trip log: every trip of the period, newest first, grouped by day. */}
        <SectionHeader tone="dark" title={t('drv.earnings.log')} style={{ marginTop: space[6] }} />
        <TripLog trips={trips} />
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
