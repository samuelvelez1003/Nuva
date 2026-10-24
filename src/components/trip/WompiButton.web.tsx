import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { useT } from '../../i18n';
import { confirmWompi, createWompiCheckout } from '../../lib/wompi';
import type { PayButtonProps } from './PaymentBox';

interface WidgetResult {
  transaction?: { id: string; status: string };
}
type WidgetCtor = new (opts: Record<string, unknown>) => { open: (cb: (r: WidgetResult) => void) => void };

let widget: Promise<WidgetCtor> | null = null;

/** Loads Wompi's checkout widget once (only ever called from a tap, never while rendering). */
function loadWidget() {
  widget ??= new Promise<WidgetCtor>((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('Wompi'));
    const s = document.createElement('script');
    s.src = 'https://checkout.wompi.co/widget.js';
    s.onload = () => resolve((window as unknown as { WidgetCheckout: WidgetCtor }).WidgetCheckout);
    s.onerror = () => {
      widget = null;
      reject(new Error('Wompi'));
    };
    document.head.appendChild(s);
  });
  return widget;
}

/** Web: Wompi's card widget opens over the page; its result is confirmed on the server. */
export function WompiButton({ tripId, tip, onPaid, onError, label }: PayButtonProps & { label?: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    onError(undefined);
    try {
      const [c, Widget] = await Promise.all([createWompiCheckout(tripId, tip), loadWidget()]);
      if (c.paid) {
        setBusy(false);
        return onPaid();
      }
      const checkout = new Widget({
        currency: c.currency,
        amountInCents: c.amountInCents,
        reference: c.reference,
        publicKey: c.publicKey,
        signature: { integrity: c.signature },
        redirectUrl: c.redirectUrl,
      });
      setBusy(false);
      checkout.open(async (result) => {
        const id = result.transaction?.id;
        if (!id) return;
        setBusy(true);
        try {
          const r = await confirmWompi(tripId, id);
          if (r.paid) onPaid();
          else onError(r.status === 'PENDING' ? t('pax.cardpay.pending') : r.error ?? t('pax.cardpay.error'));
        } catch (e) {
          onError(e instanceof Error && e.message !== 'Wompi' ? e.message : t('pax.cardpay.error'));
        } finally {
          setBusy(false);
        }
      });
    } catch (e) {
      setBusy(false);
      onError(e instanceof Error && e.message !== 'Wompi' ? e.message : t('pax.cardpay.error'));
    }
  };

  return <Button label={label ?? t('pax.cardpay.card')} variant={label ? 'outline' : 'dark'} size="md" loading={busy} onPress={start} />;
}
