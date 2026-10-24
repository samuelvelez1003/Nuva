import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Banknote, Check, CreditCard, Info, Landmark, Wallet } from 'lucide-react-native';
import { useCardPayments } from '../../../components/trip/CardPayment';
import { SavedCards } from '../../../components/wallet/SavedCards';
import { Tap } from '../../../components/ui/Button';
import { Badge, Card, Divider, Row, SectionHeader } from '../../../components/ui/primitives';
import { Header, Screen } from '../../../components/ui/Screen';
import { Txt } from '../../../components/ui/Txt';
import { paymentDetail, paymentLabel, paymentMethodsFor } from '../../../data/mock';
import { useT } from '../../../i18n';
import { useCountry } from '../../../lib/country';
import { useApp } from '../../../store/AppStore';
import { useAuth } from '../../../store/Auth';
import { colors, radius, space } from '../../../theme/tokens';

const ICON = { cash: Banknote, wallet: Wallet, bank: Landmark, card: CreditCard };

/**
 * How the passenger pays: cash, Nequi, Daviplata and Bancolombia go straight to the driver;
 * a card is paid in the app through Wompi (only shown when the server has cards on).
 * Promo codes are entered when requesting a trip.
 */
export default function PaymentMethods() {
  const { payment, setPayment } = useApp();
  const { live } = useAuth();
  const { code } = useCountry();
  const t = useT();
  const cards = useCardPayments(live);
  const methods = paymentMethodsFor(code).filter((m) => m.id !== 'card' || cards);

  // Cards switched off on the server: back to the first method paid directly.
  useEffect(() => {
    if (cards === false && payment === 'card') setPayment('cash');
  }, [cards, payment, setPayment]);

  return (
    <Screen header={<Header title={t('pax.wallet.title')} back={false} large />} contentStyle={{ paddingBottom: 140 }}>
      <SectionHeader title={t('pax.profile.payments')} />
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
          {t(cards ? 'pax.wallet.infoCards' : 'pax.wallet.infoDirect')}
        </Txt>
      </Row>

      {/* Saved cards (Wompi): pay card trips with one tap. Hidden until the server has them on. */}
      {live ? <SavedCards /> : null}
    </Screen>
  );
}
