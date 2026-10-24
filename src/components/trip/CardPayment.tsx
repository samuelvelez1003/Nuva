import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { CreditCard, HandCoins } from 'lucide-react-native';
import { Button } from '../ui/Button';
import { Chip, Row } from '../ui/primitives';
import { useToast } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { paymentLabel, paymentMethodsFor, PaymentId } from '../../data/mock';
import { useT } from '../../i18n';
import { useCountry } from '../../lib/country';
import { switchTripPayment } from '../../lib/liveTrips';
import { cardLabel, listSavedCards, paySavedCard, SavedCard, wompiConfig } from '../../lib/wompi';
import { colors } from '../../theme/tokens';
import { PaymentBox } from './PaymentBox';
import { WompiButton } from './WompiButton';

/** A method paid straight to the driver (everything but the card). */
export type DirectPayment = Exclude<PaymentId, 'card'>;

/**
 * Are card trips on? True once the server says Wompi is configured; false without a
 * backend, while it fails or when it isn't configured; null while asking.
 */
export function useCardPayments(enabled = true) {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    wompiConfig()
      .then((c) => alive && setOn(c.configured))
      .catch(() => alive && setOn(false));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled ? on : false;
}

/**
 * End-of-trip payment of a card trip: fare − promo + the tip chosen above, with a card
 * saved in the wallet (one tap) or another card (Wompi's widget on the web, its hosted
 * checkout on the phone). The server confirms it with Wompi and marks the trip paid.
 * If the card fails (or cards are off), the passenger can pay the driver directly instead.
 */
export function CardPayment({
  tripId,
  amount,
  tip,
  paid,
  onPaid,
  driverName,
  onSwitched,
}: {
  tripId: string;
  amount: number;
  tip: number;
  paid: boolean;
  onPaid: () => void;
  driverName: string;
  /** The trip now pays the driver directly with this method (the server already agreed). */
  onSwitched: (method: DirectPayment) => void;
}) {
  const t = useT();
  const toast = useToast();
  const { code } = useCountry();
  const [error, setError] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<{ cards: boolean; live: boolean } | null>(null);
  const [saved, setSaved] = useState<SavedCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [switching, setSwitching] = useState<DirectPayment | null>(null);

  useEffect(() => {
    let alive = true;
    wompiConfig()
      .then((c) => {
        if (!alive) return;
        setMode({ cards: c.configured, live: c.live });
        if (c.configured && c.savedCards) listSavedCards(c.live).then((l) => alive && setSaved(l[0] ?? null)).catch(() => {});
      })
      .catch(() => alive && setMode({ cards: false, live: false }));
    return () => {
      alive = false;
    };
  }, []);

  const showError = (message: string | undefined) => {
    setError(message);
    if (message) setFailed(true);
  };

  const paySaved = async () => {
    if (!saved) return;
    setBusy(true);
    showError(undefined);
    try {
      const r = await paySavedCard(tripId, tip, saved.id);
      if (r.paid) onPaid();
      else showError(r.status === 'PENDING' ? t('pax.cardpay.pending') : r.error ?? t('pax.cardpay.error'));
    } catch (e) {
      showError(e instanceof Error && e.message !== 'Wompi' ? e.message : t('pax.cardpay.error'));
    } finally {
      setBusy(false);
    }
  };

  const switchTo = async (method: DirectPayment) => {
    setSwitching(method);
    try {
      await switchTripPayment(tripId, method);
      onSwitched(method);
      toast(t('pax.cardpay.switched', { name: driverName, method: paymentLabel(method, t) }));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('pax.cardpay.switchError'), 'warning');
    } finally {
      setSwitching(null);
    }
  };

  const cardsOff = !!mode && !mode.cards;
  const direct = paymentMethodsFor(code).filter((m) => m.direct);

  return (
    <PaymentBox amount={amount} paid={paid} error={error} testMode={!!mode?.cards && !mode.live}>
      {cardsOff ? (
        <Txt v="small" color={colors.warningInk}>
          {t('pax.cardpay.unavailable')}
        </Txt>
      ) : null}
      {mode?.cards && saved ? (
        <Button label={t('pax.cardpay.payWith', { card: cardLabel(saved) })} icon={CreditCard} variant="dark" size="md" loading={busy} onPress={paySaved} />
      ) : null}
      {mode?.cards ? <WompiButton tripId={tripId} tip={tip} onPaid={onPaid} onError={showError} label={saved ? t('pax.cardpay.otherCard') : undefined} /> : null}

      {/* The card didn't go through: pay the driver directly instead (the server switches the trip). */}
      {failed || cardsOff ? (
        choosing ? (
          <View style={{ gap: 8 }}>
            <Txt v="smallStrong">{t('pax.cardpay.chooseDirect', { name: driverName })}</Txt>
            <Row style={{ flexWrap: 'wrap', gap: 8 }}>
              {direct.map((m) => (
                <Chip key={m.id} label={switching === m.id ? t('common.loading') : paymentLabel(m.id, t)} onPress={() => !switching && switchTo(m.id as DirectPayment)} />
              ))}
            </Row>
          </View>
        ) : (
          <Button label={t('pax.cardpay.payDriver')} icon={HandCoins} variant="ghost" size="md" onPress={() => setChoosing(true)} />
        )
      ) : null}
    </PaymentBox>
  );
}
