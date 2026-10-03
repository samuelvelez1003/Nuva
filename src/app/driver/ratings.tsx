import React from 'react';
import { View } from 'react-native';
import { Star } from 'lucide-react-native';
import { Card, EmptyState, Row, SectionHeader, Stars } from '../../components/ui/primitives';
import { Header, Screen } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { DRIVER_ME, DRIVER_REVIEWS } from '../../data/mock';
import { TKey, useT } from '../../i18n';
import { decimal, num } from '../../lib/format';
import { useApp } from '../../store/AppStore';
import { useAuth } from '../../store/Auth';
import { colors, fonts, radius, space } from '../../theme/tokens';

const DIST = [
  { s: 5, p: 0.89 },
  { s: 4, p: 0.08 },
  { s: 3, p: 0.02 },
  { s: 2, p: 0.007 },
  { s: 1, p: 0.003 },
];
const COMPLIMENTS: { t: TKey; n: number }[] = [
  { t: 'drv.ratings.cSafe', n: 642 },
  { t: 'drv.ratings.cClean', n: 518 },
  { t: 'drv.ratings.cPunctual', n: 497 },
  { t: 'drv.ratings.cChat', n: 233 },
  { t: 'drv.ratings.cMusic', n: 181 },
];

export default function DriverRatings() {
  const auth = useAuth();
  const t = useT();
  const { driverTrips } = useApp();
  const live = auth.live && !!auth.profile;

  if (live) {
    // Real ratings: the stars passengers gave on this driver's trips.
    const rated = driverTrips.filter((trip) => trip.rating);
    const avg = rated.length ? rated.reduce((a, trip) => a + (trip.rating ?? 0), 0) / rated.length : auth.profile!.rating ?? 5;
    const dist = [5, 4, 3, 2, 1].map((s) => ({ s, p: rated.length ? rated.filter((trip) => trip.rating === s).length / rated.length : 0 }));
    return (
      <Screen bg={colors.midnight} header={<Header title={t('drv.profile.ratings')} tone="dark" />}>
        <Row style={{ gap: space[5], alignItems: 'center' }}>
          <View>
            <Txt style={{ fontFamily: fonts.extrabold, fontSize: 64, letterSpacing: -3, lineHeight: 66 }} color={colors.ivory} tabular>
              {decimal(avg, 2)}
            </Txt>
            <Stars value={avg} size={16} color={colors.lime} empty={colors.midnight500} />
            <Txt v="caption" color={colors.onDarkMuted} style={{ marginTop: 6 }}>
              {rated.length ? t(rated.length === 1 ? 'drv.ratings.countOne' : 'drv.ratings.count', { n: num(rated.length) }) : t('drv.ratings.none')}
            </Txt>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            {dist.map((d) => (
              <Row key={d.s} style={{ gap: 8 }}>
                <Txt v="caption" color={colors.onDarkMuted} style={{ width: 10 }}>
                  {d.s}
                </Txt>
                <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.midnight600, overflow: 'hidden' }}>
                  <View style={{ width: `${d.p * 100}%`, height: 6, borderRadius: 3, backgroundColor: d.s >= 4 ? colors.lime : colors.midnight400 }} />
                </View>
              </Row>
            ))}
          </View>
        </Row>
        {rated.length ? null : (
          <View style={{ marginTop: space[8] }}>
            <EmptyState tone="dark" icon={Star} title={t('drv.ratings.emptyTitle')} body={t('drv.ratings.emptyBody')} />
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen bg={colors.midnight} header={<Header title={t('drv.profile.ratings')} tone="dark" />}>
      <Row style={{ gap: space[5], alignItems: 'center' }}>
        <View>
          <Txt style={{ fontFamily: fonts.extrabold, fontSize: 64, letterSpacing: -3, lineHeight: 66 }} color={colors.ivory} tabular>
            {decimal(DRIVER_ME.rating, 2)}
          </Txt>
          <Stars value={DRIVER_ME.rating} size={16} color={colors.lime} empty={colors.midnight500} />
          <Txt v="caption" color={colors.onDarkMuted} style={{ marginTop: 6 }}>
            {t('drv.ratings.demoCount', { n: num(DRIVER_ME.ratingsCount), trips: 500 })}
          </Txt>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          {DIST.map((d) => (
            <Row key={d.s} style={{ gap: 8 }}>
              <Txt v="caption" color={colors.onDarkMuted} style={{ width: 10 }}>
                {d.s}
              </Txt>
              <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.midnight600, overflow: 'hidden' }}>
                <View style={{ width: `${Math.max(2, d.p * 100)}%`, height: 6, borderRadius: 3, backgroundColor: d.s >= 4 ? colors.lime : colors.midnight400 }} />
              </View>
            </Row>
          ))}
        </View>
      </Row>

      <SectionHeader tone="dark" title={t('drv.ratings.highlights')} style={{ marginTop: space[8] }} />
      <Row style={{ flexWrap: 'wrap', gap: 8 }}>
        {COMPLIMENTS.map((c) => (
          <Row key={c.t} style={{ gap: 8, paddingHorizontal: 14, height: 38, borderRadius: radius.pill, backgroundColor: colors.midnight700, borderWidth: 1, borderColor: colors.lineDark }}>
            <Txt v="smallStrong" color={colors.ivory}>
              {t(c.t)}
            </Txt>
            <Txt v="caption" color={colors.lime} tabular>
              {c.n}
            </Txt>
          </Row>
        ))}
      </Row>

      <SectionHeader tone="dark" title={t('drv.ratings.recent')} style={{ marginTop: space[8] }} />
      {DRIVER_REVIEWS.map((r) => (
        <Card key={r.id} tone="dark" style={{ marginBottom: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="smallStrong" color={colors.ivory}>
              {r.name}
            </Txt>
            <Stars value={r.stars} size={12} color={colors.lime} empty={colors.midnight500} />
          </Row>
          <Txt v="body" color={colors.onDark} style={{ marginTop: 8 }}>
            “{r.text}”
          </Txt>
          <Txt v="caption" color={colors.onDarkFaint} style={{ marginTop: 6 }}>
            {r.when}
          </Txt>
        </Card>
      ))}
      <Txt v="caption" color={colors.onDarkFaint} style={{ marginTop: space[3] }}>
        {t('drv.ratings.footnote', { n: 3 })}
      </Txt>
    </Screen>
  );
}
