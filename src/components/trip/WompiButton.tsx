import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { useT } from '../../i18n';
import { confirmWompi, createWompiCheckout } from '../../lib/wompi';
import { CheckoutSheet } from './CheckoutSheet';
import type { PayButtonProps } from './PaymentBox';

/** Native app: Wompi's hosted card checkout; Wompi returns with ?id=<transaction>. */
export function WompiButton({ tripId, tip, onPaid, onError, label }: PayButtonProps & { label?: string }) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    onError(undefined);
    try {
      const c = await createWompiCheckout(tripId, tip);
      if (c.paid) return onPaid();
      setUrl(c.checkoutUrl);
    } catch (e) {
      onError(e instanceof Error && e.message !== 'Wompi' ? e.message : t('pax.cardpay.error'));
    } finally {
      setBusy(false);
    }
  };

  const back = async (returnUrl: string) => {
    setUrl(null);
    const id = /[?&]id=([^&#]+)/.exec(returnUrl)?.[1];
    if (!id) return;
    setBusy(true);
    try {
      const r = await confirmWompi(tripId, decodeURIComponent(id));
      if (r.paid) onPaid();
      else onError(r.status === 'PENDING' ? t('pax.cardpay.pending') : r.error ?? t('pax.cardpay.error'));
    } catch (e) {
      onError(e instanceof Error && e.message !== 'Wompi' ? e.message : t('pax.cardpay.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button label={label ?? t('pax.cardpay.card')} variant={label ? 'outline' : 'dark'} size="md" loading={busy} onPress={start} />
      <CheckoutSheet url={url} onReturn={back} onClose={() => setUrl(null)} />
    </>
  );
}
