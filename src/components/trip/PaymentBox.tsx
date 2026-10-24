import React from 'react';
import { View } from 'react-native';
import { CheckCircle2, CreditCard } from 'lucide-react-native';
import { Badge, Row } from '../ui/primitives';
import { Txt } from '../ui/Txt';
import { useT } from '../../i18n';
import { cop } from '../../lib/format';
import { colors, radius } from '../../theme/tokens';

/** What the card buttons receive. */
export interface PayButtonProps {
  tripId: string;
  tip: number;
  onPaid: () => void;
  onError: (message: string | undefined) => void;
}

/**
 * Frame of the end-of-trip card payment: total (in pesos, through Wompi), test-mode note
 * and paid state. The buttons go inside as children.
 */
export function PaymentBox({ amount, paid, error, testMode, children }: { amount: number; paid: boolean; error?: string; testMode: boolean; children: React.ReactNode }) {
  const t = useT();
  return (
    <View style={{ marginTop: 10, padding: 16, borderRadius: radius.lg, backgroundColor: paid ? colors.mint : colors.ivory100, gap: 10 }}>
      <Row style={{ gap: 10 }}>
        {paid ? <CheckCircle2 size={20} color={colors.mintInk} /> : <CreditCard size={20} color={colors.ink} />}
        <Txt v="title" style={{ flex: 1 }}>
          {t(paid ? 'pax.cardpay.paid' : 'pax.cardpay.title')}
        </Txt>
        {testMode && !paid ? <Badge label={t('pax.cardpay.testBadge')} tone="warning" /> : null}
      </Row>
      {paid ? (
        <Txt v="small" color={colors.mintInk}>
          {t('pax.cardpay.paidBody', { amount: cop(amount) })}
        </Txt>
      ) : (
        <>
          <Txt v="bodyStrong">{t('pax.cardpay.total', { amount: cop(amount) })}</Txt>
          <Txt v="caption" color={colors.inkMuted}>
            {t('pax.cardpay.notes')}
          </Txt>
        </>
      )}
      {testMode && !paid ? (
        <Txt v="caption" color={colors.warningInk}>
          {t('pax.cardpay.test')}
        </Txt>
      ) : null}
      {paid ? null : children}
      {error && !paid ? (
        <Txt v="small" color={colors.dangerInk} accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}
