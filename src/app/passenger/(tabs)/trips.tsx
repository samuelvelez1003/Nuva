import React, { useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import { openTicket } from '../../../lib/liveTrips';
import { useAuth } from '../../../store/Auth';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { CalendarX2, ChevronDown, ChevronUp, Leaf, Receipt } from 'lucide-react-native';
import { RouteGlyph } from '../../../components/brand/Brand';
import { FareBreakdownCard } from '../../../components/fare/FareBreakdownCard';
import { Button, Tap } from '../../../components/ui/Button';
import { Badge, Card, EmptyState, Row, Segmented, Stars } from '../../../components/ui/primitives';
import { Header, Screen, useToast } from '../../../components/ui/Screen';
import { Money, Txt } from '../../../components/ui/Txt';
import { paymentLabel } from '../../../data/mock';
import { useT } from '../../../i18n';
import { clock, cop, dayLabel, km, minutes } from '../../../lib/format';
import { PassengerTrip, useApp } from '../../../store/AppStore';
import { colors, radius, space } from '../../../theme/tokens';

function TripCard({ trip, index }: { trip: PassengerTrip; index: number }) {
  const { pricing } = useApp();
  const { live } = useAuth();
  const toast = useToast();
  const t = useT();
  const [open, setOpen] = useState(false);
  const cancelled = trip.status === 'cancelado';
  const a11yVars = { place: trip.to.name, amount: cop(trip.fare.finalFare) };
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(300)}>
      <Card padded={false} style={{ marginBottom: 10, overflow: 'hidden' }}>
        <Tap
          onPress={() => setOpen((o) => !o)}
          scaleTo={0.99}
          accessibilityLabel={open ? t('pax.trips.cardA11yHide', a11yVars) : t('pax.trips.cardA11yShow', a11yVars)}
          accessibilityState={{ expanded: open }}
        >
          <View style={{ padding: space[4] }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <Txt v="caption" color={colors.inkMuted}>
                {dayLabel(trip.date)} · {clock(trip.date)}
              </Txt>
              {cancelled ? (
                <Badge label={t('pax.trips.cancelled')} tone="danger" />
              ) : trip.rating ? (
                <Stars value={trip.rating} size={11} />
              ) : (
                <Badge label={t('pax.trips.unrated')} tone="warning" />
              )}
            </Row>
            <Row style={{ gap: 12, alignItems: 'stretch' }}>
              <RouteGlyph height={48} />
              <View style={{ flex: 1, justifyContent: 'space-between' }}>
                <Txt v="small" color={colors.inkMuted} numberOfLines={1}>
                  {trip.from.id === 'current' ? trip.from.address : trip.from.name}
                </Txt>
                <Txt v="bodyStrong" numberOfLines={1}>
                  {trip.to.name}
                </Txt>
              </View>
              <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <Txt v="title" tabular color={cancelled ? colors.inkMuted : colors.ink} style={cancelled ? { textDecorationLine: 'line-through' } : undefined}>
                  {cop(trip.fare.finalFare)}
                </Txt>
                {open ? <ChevronUp size={18} color={colors.inkMuted} /> : <ChevronDown size={18} color={colors.inkMuted} />}
              </View>
            </Row>
          </View>
        </Tap>
        {open ? (
          <Animated.View entering={FadeIn.duration(200)} style={{ paddingHorizontal: space[4], paddingBottom: space[4], borderTopWidth: 1, borderTopColor: colors.lineLight, paddingTop: space[4] }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <Txt v="caption" color={colors.inkMuted}>
                {trip.car ? `${trip.driverName} · ${trip.car}` : trip.driverName}
              </Txt>
            </Row>
            <Txt v="caption" color={colors.inkMuted} style={{ marginBottom: 10 }}>
              {trip.id} · {paymentLabel(trip.payment, t)} · {km(trip.fare.distanceKm)} · {minutes(trip.fare.durationMin)}
            </Txt>
            {cancelled ? (
              <Txt v="small" color={colors.inkSoft}>
                {t('pax.trips.cancelledNote')}
              </Txt>
            ) : (
              <>
                <FareBreakdownCard fare={trip.fare} config={pricing} compact />
                <Row style={{ gap: 10, marginTop: space[4] }}>
                  <Button
                    label={t('pax.trips.receipt')}
                    icon={Receipt}
                    variant="outline"
                    size="sm"
                    full={false}
                    onPress={() => {
                      if (!live) return toast(t('pax.trips.receiptSent', { email: 'valentina.rios@correo.co' }));
                      // Live: the receipt goes through the phone's share sheet (mail, WhatsApp, files…).
                      const receipt = t('pax.trips.receiptText', {
                        code: trip.id,
                        date: `${dayLabel(trip.date)} ${clock(trip.date)}`,
                        from: trip.from.id === 'current' ? trip.from.address : trip.from.name,
                        to: trip.to.name,
                        km: km(trip.fare.distanceKm),
                        payment: paymentLabel(trip.payment, t),
                        amount: cop(trip.fare.finalFare),
                      });
                      Share.share({ message: receipt }).catch(() => {});
                    }}
                  />
                  <Button
                    label={t('pax.trips.report')}
                    variant="ghost"
                    size="sm"
                    full={false}
                    onPress={() => {
                      if (!live) return toast(t('pax.trips.reportToast'), 'info');
                      openTicket(`${t('pax.trips.report')}: ${trip.id}`, `${trip.to.name} · ${cop(trip.fare.finalFare)}`)
                        .then((code) => toast(t('pax.help.caseOpened', { code })))
                        .catch(() => toast(t('pax.help.sendError'), 'warning'));
                    }}
                  />
                </Row>
              </>
            )}
          </Animated.View>
        ) : null}
      </Card>
    </Animated.View>
  );
}

export default function TripHistory() {
  const { passengerTrips } = useApp();
  const t = useT();
  const [filter, setFilter] = useState<'all' | 'done' | 'cancelled' | 'scheduled'>('all');

  const list = useMemo(
    () =>
      filter === 'scheduled'
        ? []
        : passengerTrips.filter((trip) => (filter === 'all' ? true : filter === 'done' ? trip.status === 'completado' : trip.status === 'cancelado')),
    [passengerTrips, filter],
  );
  const month = passengerTrips.filter((trip) => trip.status === 'completado' && trip.date.getMonth() === new Date().getMonth());
  const spent = month.reduce((a, trip) => a + trip.fare.finalFare, 0);
  // ≈1.9 kg CO₂ saved per electric trip (no invented baseline).
  const avoided = month.filter((trip) => trip.fare.category === 'eco').length * 1.9;

  return (
    <Screen header={<Header title={t('pax.trips.title')} back={false} large />} contentStyle={{ paddingBottom: 140 }}>
      <Card tone="dark" style={{ marginBottom: space[5] }}>
        <Txt v="overline" color={colors.onDarkMuted}>
          {t('pax.trips.thisMonth')}
        </Txt>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 }}>
          <View>
            <Money value={cop(spent)} size={34} color={colors.ivory} signColor={colors.lime} />
            <Txt v="small" color={colors.onDarkMuted}>
              {t('pax.trips.monthSummary', { count: month.length, avg: cop(month.length ? Math.round(spent / month.length) : 0) })}
            </Txt>
          </View>
          <Row style={{ gap: 6, backgroundColor: colors.midnight600, paddingHorizontal: 10, height: 30, borderRadius: radius.pill }}>
            <Leaf size={14} color={colors.lime} />
            <Txt v="caption" color={colors.ivory}>
              −{avoided.toFixed(1).replace('.', ',')} kg CO₂
            </Txt>
          </Row>
        </Row>
      </Card>

      <Segmented
        value={filter}
        onChange={setFilter}
        style={{ marginBottom: space[4] }}
        options={[
          { value: 'all', label: t('pax.trips.filterAll') },
          { value: 'done', label: t('pax.trips.filterDone') },
          { value: 'cancelled', label: t('pax.trips.filterCancelled') },
          { value: 'scheduled', label: t('pax.trips.filterUpcoming') },
        ]}
      />
      {list.length ? (
        list.map((trip, i) => <TripCard key={trip.id} trip={trip} index={i} />)
      ) : (
        <EmptyState icon={CalendarX2} title={t('pax.trips.emptyTitle')} body={t('pax.trips.emptyBody')} />
      )}
    </Screen>
  );
}
