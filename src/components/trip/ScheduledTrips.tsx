import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CalendarClock, Sparkles } from 'lucide-react-native';
import { Tap } from '../ui/Button';
import { Row } from '../ui/primitives';
import { useToast } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { useT } from '../../i18n';
import { cop } from '../../lib/format';
import { cancelTrip, fetchScheduledTrips, TripRow } from '../../lib/liveTrips';
import { whenLabel } from '../../lib/schedule';
import { useAuth } from '../../store/Auth';
import { colors, radius, shadow, space } from '../../theme/tokens';

/** The signed-in passenger's scheduled trips not yet offered to drivers (re-read on focus). */
export function useScheduledTrips() {
  const { live, session } = useAuth();
  const uid = live ? session?.user.id : undefined;
  const [trips, setTrips] = useState<TripRow[]>([]);
  const reload = useCallback(async () => {
    if (!uid) return setTrips([]);
    await fetchScheduledTrips(uid)
      .then(setTrips)
      .catch(() => {});
  }, [uid]);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  return { trips, reload };
}

/** One scheduled trip: when, route, price and a cancel action that asks for a second tap. */
function ScheduledRow({ trip, onCancelled, floating }: { trip: TripRow; onCancelled: () => void; floating?: boolean }) {
  const t = useT();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const when = trip.scheduled_for ? whenLabel(new Date(trip.scheduled_for), t) : '';

  const cancel = async () => {
    if (!confirm) {
      setConfirm(true);
      timer.current = setTimeout(() => setConfirm(false), 5000);
      return;
    }
    setBusy(true);
    try {
      await cancelTrip(trip.id);
      toast(t('pax.sched.cancelled'), 'info');
      onCancelled();
    } catch (e) {
      toast(e instanceof Error ? e.message : t('pax.ride.cancelError'), 'warning');
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <Row
      style={[
        { gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lineLight },
        floating ? shadow.soft : null,
      ]}
      accessible
      accessibilityLabel={t('pax.sched.rowA11y', { when, from: trip.pickup.name, to: trip.destination.name, amount: cop(trip.final_fare - (trip.discount ?? 0)) })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center' }}>
        <CalendarClock size={18} color={colors.limeOnDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Row style={{ gap: 6 }}>
          <Txt v="smallStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {when} · {cop(trip.final_fare - (trip.discount ?? 0))}
          </Txt>
          {trip.women_only ? <Sparkles size={13} color={colors.limeInk} /> : null}
        </Row>
        <Txt v="caption" color={colors.inkMuted} numberOfLines={1}>
          {trip.pickup.name} → {trip.destination.name}
        </Txt>
      </View>
      <Tap onPress={cancel} disabled={busy} hitSlop={8} accessibilityLabel={confirm ? t('pax.sched.confirmCancel') : t('pax.sched.cancel')}>
        <Txt v="smallStrong" color={confirm ? colors.dangerInk : colors.inkMuted}>
          {busy ? t('common.loading') : confirm ? t('pax.sched.confirmCancel') : t('pax.sched.cancel')}
        </Txt>
      </Tap>
    </Row>
  );
}

/** List of scheduled trips (home shows only the next one, floating over the map). */
export function ScheduledTripsList({
  trips,
  onChanged,
  limit,
  floating,
  onMore,
  style,
}: {
  trips: TripRow[];
  onChanged: () => void;
  limit?: number;
  floating?: boolean;
  onMore?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useT();
  if (!trips.length) return null;
  const shown = limit ? trips.slice(0, limit) : trips;
  const more = trips.length - shown.length;
  return (
    <View style={[{ gap: space[2] }, style]}>
      {shown.map((trip) => (
        <ScheduledRow key={trip.id} trip={trip} onCancelled={onChanged} floating={floating} />
      ))}
      {more > 0 && onMore ? (
        <Tap onPress={onMore} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
          <Txt v="caption" color={colors.ink} style={{ textDecorationLine: 'underline' }}>
            {t(more === 1 ? 'pax.sched.moreOne' : 'pax.sched.moreMany', { n: more })}
          </Txt>
        </Tap>
      ) : null}
    </View>
  );
}
