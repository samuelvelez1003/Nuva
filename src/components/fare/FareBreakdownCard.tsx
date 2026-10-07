import React from 'react';
import { View } from 'react-native';
import { Info } from 'lucide-react-native';
import { useT } from '../../i18n';
import { FareBreakdown, PricingConfig } from '../../lib/fare';
import { cop, decimal, km, minutes } from '../../lib/format';
import { colors, radius, space } from '../../theme/tokens';
import { Badge, Divider, KeyValue, Row } from '../ui/primitives';
import { Money, Txt } from '../ui/Txt';

/**
 * The single fare breakdown used everywhere. Passengers see what they pay
 * and how it's split; drivers see the same numbers from their side.
 */
export function FareBreakdownCard({
  fare,
  config,
  audience = 'passenger',
  tone = 'light',
  compact,
}: {
  fare: FareBreakdown;
  config: PricingConfig;
  audience?: 'passenger' | 'driver';
  tone?: 'light' | 'dark';
  compact?: boolean;
}) {
  const t = useT();
  const dark = tone === 'dark';
  const mult = config.categories[fare.category]?.multiplier ?? 1;
  const multNote = mult !== 1 ? ` × ${decimal(mult, 2)}` : '';
  const muted = dark ? colors.onDarkMuted : colors.inkMuted;
  const driverPct = 100 - fare.commissionPct;
  const driverPctText = decimal(driverPct, driverPct % 1 ? 1 : 0);
  const commissionPctText = decimal(fare.commissionPct, fare.commissionPct % 1 ? 1 : 0);

  return (
    <View>
      <KeyValue tone={tone} label={t('pax.fare.base')} value={cop(fare.baseFare)} />
      <KeyValue
        tone={tone}
        label={t('pax.fare.distance')}
        hint={`${km(fare.distanceKm)} × ${cop(config.pricePerKm)}/km${multNote}`}
        value={cop(fare.distanceCharge)}
      />
      <KeyValue
        tone={tone}
        label={t('pax.fare.time')}
        hint={`${minutes(fare.durationMin)} × ${cop(config.pricePerMinute)}/min${multNote}`}
        value={cop(fare.timeCharge)}
      />
      {fare.nightSurcharge > 0 ? <KeyValue tone={tone} label={t('pax.fare.night')} value={`+${cop(fare.nightSurcharge)}`} /> : null}
      {fare.airportSurcharge > 0 ? <KeyValue tone={tone} label={t('pax.fare.airport')} value={`+${cop(fare.airportSurcharge)}`} /> : null}
      {fare.minimumApplied ? (
        <KeyValue tone={tone} label={t('pax.fare.minAdjust')} hint={t('pax.fare.minHint', { amount: cop(fare.finalFare) })} value={`+${cop(fare.minimumAdjustment)}`} />
      ) : null}
      <Divider tone={tone} style={{ marginVertical: 8 }} />
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Txt v="overline" color={muted}>
            {audience === 'passenger' ? t('pax.fare.totalPay') : t('pax.fare.tripFare')}
          </Txt>
          {fare.minimumApplied ? <Badge label={t('pax.fare.minFare')} tone={dark ? 'ghostDark' : 'neutral'} style={{ marginTop: 6 }} /> : null}
        </View>
        <Money value={cop(fare.finalFare)} size={compact ? 26 : 32} color={dark ? colors.ivory : colors.ink} />
      </Row>

      {/* Split bar: where every peso goes */}
      <View style={{ marginTop: space[4], padding: 14, borderRadius: radius.md, backgroundColor: dark ? colors.midnight700 : colors.ivory100 }}>
        <Row style={{ height: 10, borderRadius: 5, overflow: 'hidden', gap: 3 }}>
          <View style={{ flex: driverPct, height: 10, backgroundColor: dark ? colors.lime : colors.midnight, borderRadius: 5 }} />
          <View style={{ flex: Math.max(fare.commissionPct, 0.5), height: 10, backgroundColor: dark ? colors.midnight400 : colors.ivory400, borderRadius: 5 }} />
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
          <View>
            <Txt v="caption" color={muted}>
              {audience === 'passenger' ? t('pax.fare.forDriverPct', { pct: driverPctText }) : t('pax.fare.netPct', { pct: driverPctText })}
            </Txt>
            <Txt v="title" tabular color={dark ? colors.lime : colors.ink}>
              {cop(fare.driverEarnings)}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt v="caption" color={muted}>
              {t('pax.fare.commissionPct', { pct: commissionPctText })}
            </Txt>
            <Txt v="title" tabular color={dark ? colors.onDark : colors.inkSoft}>
              {cop(fare.platformCommission)}
            </Txt>
          </View>
        </Row>
      </View>
      {!compact ? (
        <Row style={{ gap: 8, marginTop: space[3], alignItems: 'flex-start' }}>
          <Info size={14} color={muted} style={{ marginTop: 2 }} />
          <Txt v="caption" color={muted} style={{ flex: 1 }}>
            {audience === 'passenger' ? t('pax.fare.paxNote') : t('pax.fare.drvNote')}
          </Txt>
        </Row>
      ) : null}
    </View>
  );
}
