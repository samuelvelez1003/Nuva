import React, { useState } from 'react';
import { View } from 'react-native';
import { Banknote, Check, CreditCard, Gift, Info, Landmark, Wallet } from 'lucide-react-native';
import { AppIcon } from '../../../components/brand/Brand';
import { Button, Tap } from '../../../components/ui/Button';
import { Badge, Card, Divider, Field, Row, SectionHeader } from '../../../components/ui/primitives';
import { Header, Screen, useToast } from '../../../components/ui/Screen';
import { Money, Txt } from '../../../components/ui/Txt';
import { paymentDetail, paymentLabel, paymentMethodsFor } from '../../../data/mock';
import { useT } from '../../../i18n';
import { useCountry } from '../../../lib/country';
import { cop } from '../../../lib/format';
import { useApp } from '../../../store/AppStore';
import { useAuth } from '../../../store/Auth';
import { colors, radius, space } from '../../../theme/tokens';

const ICON = { cash: Banknote, wallet: Wallet, bank: Landmark, card: CreditCard };
const PROMO_CODE = 'NUVAFRESH';
const PROMO_CREDIT = 8000;

export default function PaymentMethods() {
  const { payment, setPayment } = useApp();
  const { live } = useAuth();
  const { code, country } = useCountry();
  const toast = useToast();
  const t = useT();
  const [promo, setPromo] = useState('');
  const [promoError, setPromoError] = useState<string>();
  const [credit, setCredit] = useState(24500);
  const methods = paymentMethodsFor(code);

  const redeem = () => {
    const c = promo.trim().toUpperCase();
    if (c === PROMO_CODE) {
      setCredit((v) => v + PROMO_CREDIT);
      setPromo('');
      setPromoError(undefined);
      toast(t('pax.wallet.promoApplied', { amount: cop(PROMO_CREDIT) }));
    } else setPromoError(t('pax.wallet.promoInvalid', { code: PROMO_CODE }));
  };

  return (
    <Screen header={<Header title={t('pax.wallet.title')} back={false} large />} contentStyle={{ paddingBottom: 140 }}>
      {/* NÜVA Cash and promo codes are demo-only: there is no stored passenger credit yet. */}
      {live ? null : (
        <View style={{ backgroundColor: colors.lime, borderRadius: radius.xl, padding: space[5], overflow: 'hidden', marginBottom: space[6] }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="overline" color={colors.midnight}>
              NÜVA Cash
            </Txt>
            <AppIcon size={34} />
          </Row>
          <Money value={cop(credit)} size={44} color={colors.midnight} style={{ marginTop: space[6] }} />
          <Txt v="small" color={colors.midnight}>
            {t('pax.wallet.balanceNote')}
          </Txt>
          <View style={{ position: 'absolute', right: -40, bottom: -60, width: 180, height: 180, borderRadius: 90, borderWidth: 26, borderColor: 'rgba(16,20,17,0.06)' }} />
        </View>
      )}

      <SectionHeader title={t('pax.wallet.methods', { country: country.name })} />
      <Card padded={false} style={{ paddingHorizontal: space[4] }}>
        {methods.map((m, i) => {
          const Icon = ICON[m.kind];
          const active = payment === m.id;
          const label = paymentLabel(m.id, t);
          const detail = paymentDetail(m.id, t);
          return (
            <View key={m.id}>
              {i ? <Divider inset={58} /> : null}
              <Tap onPress={() => setPayment(m.id)} accessibilityState={{ selected: active }} accessibilityLabel={`${label} ${detail}`}>
                <Row style={{ paddingVertical: 14, gap: 14 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: active ? colors.midnight : colors.ivory100, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} color={active ? colors.lime : colors.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Row style={{ gap: 8 }}>
                      <Txt v="bodyStrong">{label}</Txt>
                      {active ? <Badge label={t('pax.wallet.default')} tone="success" /> : null}
                    </Row>
                    <Txt v="caption" color={colors.inkMuted}>
                      {detail}
                    </Txt>
                  </View>
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: active ? colors.midnight : colors.ivory400, backgroundColor: active ? colors.midnight : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {active ? <Check size={14} color={colors.lime} strokeWidth={3} /> : null}
                  </View>
                </Row>
              </Tap>
            </View>
          );
        })}
      </Card>
      <Row style={{ gap: 10, alignItems: 'flex-start', marginTop: space[3], padding: 14, borderRadius: radius.md, backgroundColor: colors.ivory200 }}>
        <Info size={16} color={colors.inkSoft} style={{ marginTop: 2 }} />
        <Txt v="small" color={colors.inkSoft} style={{ flex: 1 }}>
          {t('pax.wallet.directInfo', { methods: country.web.paymentNames.join(', ') })}
        </Txt>
      </Row>

      {live ? null : (
        <>
          <SectionHeader title={t('pax.wallet.promoTitle')} style={{ marginTop: space[6] }} />
          <Card style={{ gap: space[3] }}>
            <Row style={{ gap: 10 }}>
              <Gift size={18} color={colors.ink} />
              <Txt v="small" color={colors.inkSoft} style={{ flex: 1 }}>
                {t('pax.wallet.promoInfo')}
              </Txt>
            </Row>
            <Field
              placeholder={t('pax.wallet.promoPh')}
              value={promo}
              onChangeText={(v) => {
                setPromo(v);
                setPromoError(undefined);
              }}
              autoCapitalize="characters"
              error={promoError}
            />
            <Button label={t('pax.wallet.apply')} variant="dark" size="md" disabled={promo.trim().length < 4} onPress={redeem} />
          </Card>
        </>
      )}
    </Screen>
  );
}
