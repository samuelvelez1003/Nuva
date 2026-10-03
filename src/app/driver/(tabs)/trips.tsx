import React, { useMemo, useState } from 'react';
import { SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Route, Star } from 'lucide-react-native';
import { RouteGlyph } from '../../../components/brand/Brand';
import { EmptyState, Row, Segmented } from '../../../components/ui/primitives';
import { Header, useStatusTone } from '../../../components/ui/Screen';
import { Txt } from '../../../components/ui/Txt';
import { useT } from '../../../i18n';
import { clock, cop, dayLabel, km } from '../../../lib/format';
import { DriverTrip, startOfWeek, sumTrips, useApp } from '../../../store/AppStore';
import { colors, radius, space } from '../../../theme/tokens';

export default function DriverTripHistory() {
  const insets = useSafeAreaInsets();
  const { driverTrips, pricing } = useApp();
  const [range, setRange] = useState<'week' | 'all'>('week');
  const tr = useT();
  useStatusTone('light');

  const sections = useMemo(() => {
    const list = range === 'week' ? driverTrips.filter((t) => t.date >= startOfWeek()) : driverTrips.slice(0, 120);
    const map = new Map<string, DriverTrip[]>();
    for (const t of list) {
      const k = dayLabel(t.date);
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    return [...map.entries()].map(([title, data]) => ({ title, data, total: sumTrips(data).net }));
  }, [driverTrips, range]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight, paddingTop: insets.top }}>
      <Header title={tr('tabs.trips')} back={false} large tone="dark" />
      <View style={{ paddingHorizontal: space[5], marginBottom: space[3] }}>
        <Segmented
          tone="dark"
          value={range}
          onChange={setRange}
          options={[
            { value: 'week', label: tr('drv.trips.thisWeek') },
            { value: 'all', label: tr('drv.trips.allHistory') },
          ]}
        />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: insets.bottom + 120 }}
        ListEmptyComponent={
          <EmptyState tone="dark" icon={Route} title={range === 'week' ? tr('drv.trips.emptyTitle') : tr('drv.trips.emptyAllTitle')} body={tr('drv.trips.emptyBody')} />
        }
        renderSectionHeader={({ section }) => (
          <Row style={{ justifyContent: 'space-between', paddingTop: space[4], paddingBottom: 8, backgroundColor: colors.midnight }}>
            <Txt v="overline" color={colors.onDarkMuted}>
              {tr(section.data.length === 1 ? 'drv.trips.dayHeaderOne' : 'drv.trips.dayHeader', { day: section.title, n: section.data.length })}
            </Txt>
            <Txt v="smallStrong" color={colors.lime} tabular>
              {cop(section.total)}
            </Txt>
          </Row>
        )}
        renderItem={({ item: t }) => (
          <View style={{ backgroundColor: colors.midnight700, borderRadius: radius.lg, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.lineDark }}>
            <Row style={{ gap: 12, alignItems: 'stretch' }}>
              <RouteGlyph height={42} color={colors.ivory} dashed={colors.midnight400} />
              <View style={{ flex: 1, justifyContent: 'space-between' }}>
                <Txt v="caption" color={colors.onDarkMuted} numberOfLines={1}>
                  {clock(t.date)} · {t.from.id === 'current' ? t.from.address : t.from.name}
                </Txt>
                <Txt v="smallStrong" color={colors.ivory} numberOfLines={1}>
                  {t.to.name}
                </Txt>
              </View>
              <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <Txt v="bodyStrong" color={colors.lime} tabular>
                  +{cop(t.fare.driverEarnings)}
                </Txt>
                <Txt v="caption" color={colors.onDarkFaint} tabular>
                  {km(t.fare.distanceKm)} · {pricing.categories[t.fare.category]?.name}
                </Txt>
              </View>
            </Row>
            <Row style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.lineDark, justifyContent: 'space-between' }}>
              <Txt v="caption" color={colors.onDarkFaint} tabular>
                {tr('drv.trips.detail', { passenger: t.passenger, fare: cop(t.fare.finalFare), commission: cop(t.fare.platformCommission) })}
              </Txt>
              {t.rating ? (
                <Row style={{ gap: 3 }}>
                  <Star size={11} color={colors.lime} fill={colors.lime} />
                  <Txt v="caption" color={colors.onDark}>
                    {t.rating}
                  </Txt>
                </Row>
              ) : null}
            </Row>
          </View>
        )}
      />
    </View>
  );
}
