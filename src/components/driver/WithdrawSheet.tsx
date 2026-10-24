import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock3, X } from 'lucide-react-native';
import { Button, IconButton } from '../ui/Button';
import { Chip, Field, Row } from '../ui/primitives';
import { useToast } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { TKey, useT } from '../../i18n';
import { cop, moneyCurrency, num, parseInteger } from '../../lib/format';
import { PAYOUT_METHODS, PayoutMethod, requestWithdrawal, savedPayoutAccount, validPayoutAccount } from '../../lib/payouts';
import { useAuth } from '../../store/Auth';
import { colors, radius, space } from '../../theme/tokens';

/** Where a withdrawal goes (form and wallet movements). */
export const PAYOUT_LABEL: Record<PayoutMethod, TKey> = {
  nequi: 'drv2.wd.nequi',
  daviplata: 'drv2.wd.daviplata',
  bancolombia: 'drv2.wd.bancolombia',
  banco: 'drv2.wd.bank',
};

/**
 * Driver wallet → "Retirar": method, account (prefilled from the payout data given at
 * sign-up) and amount. The team pays it by hand from the admin's Retiros page.
 * Render it only while open (its form starts fresh on every mount).
 */
export function WithdrawSheet({
  visible,
  withdrawable,
  minWithdrawal,
  onClose,
  onDone,
}: {
  visible: boolean;
  withdrawable: number;
  minWithdrawal: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const { profile } = useAuth();
  // Mounted fresh each time it opens: all that can be withdrawn, to the Nequi registered at sign-up.
  const [method, setMethod] = useState<PayoutMethod>('nequi');
  const [account, setAccount] = useState(() => savedPayoutAccount(profile, 'nequi'));
  const [amount, setAmount] = useState(withdrawable);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const pick = (m: PayoutMethod) => {
    setMethod(m);
    setAccount(savedPayoutAccount(profile, m) || (m === 'daviplata' || m === 'nequi' ? account.replace(/\D/g, '') : ''));
  };

  const chips = Array.from(new Set([minWithdrawal, 50_000, 100_000].filter((a) => a >= minWithdrawal && a < withdrawable)));
  const accountOk = validPayoutAccount(method, account);
  const amountError =
    amount && amount < minWithdrawal ? t('drv2.wd.min', { min: cop(minWithdrawal) }) : amount > withdrawable ? t('drv2.wd.max', { max: cop(withdrawable) }) : undefined;
  const valid = accountOk && !!amount && !amountError;
  const phone = method === 'nequi' || method === 'daviplata';

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await requestWithdrawal(amount, method, account);
      toast(t('drv2.wd.requested', { amount: cop(amount) }), 'success');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={Platform.OS === 'web'}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.midnight }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: space[4], paddingVertical: space[2] }}>
            <Txt v="h3" color={colors.ivory}>
              {t('drv2.wd.sheetTitle')}
            </Txt>
            <IconButton icon={X} label={t('cards.close')} tone="clearDark" onPress={onClose} />
          </Row>
          <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], maxWidth: 480, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
            <View>
              <Txt v="caption" color={colors.onDarkMuted}>
                {t('drv2.wd.available')}
              </Txt>
              <Txt v="h2" color={colors.lime} tabular>
                {cop(withdrawable)}
              </Txt>
            </View>

            <View style={{ gap: 8 }}>
              <Txt v="caption" color={colors.onDarkMuted}>
                {t('drv2.wd.where')}
              </Txt>
              <Row style={{ flexWrap: 'wrap', gap: 8 }}>
                {PAYOUT_METHODS.map((m) => (
                  <Chip key={m} tone="dark" label={t(PAYOUT_LABEL[m])} active={method === m} onPress={() => pick(m)} />
                ))}
              </Row>
            </View>
            <Field
              tone="dark"
              label={phone ? t('drv2.wd.phone', { method: t(PAYOUT_LABEL[method]) }) : t('drv2.wd.account')}
              value={account}
              onChangeText={(v) => setAccount(phone ? v.replace(/\D/g, '').slice(0, 10) : v.slice(0, 60))}
              keyboardType={phone ? 'number-pad' : 'default'}
              placeholder={phone ? '3001234567' : t('drv2.wd.accountPh')}
              error={account && !accountOk ? (phone ? t('drv2.wd.phoneInvalid') : t('drv2.wd.accountInvalid')) : undefined}
            />

            <View style={{ gap: 8 }}>
              <Field
                tone="dark"
                label={t('drv2.wd.amount')}
                prefix={moneyCurrency().symbol}
                value={amount ? num(amount) : ''}
                onChangeText={(v) => setAmount(parseInteger(v))}
                keyboardType="number-pad"
                placeholder={num(minWithdrawal)}
                error={amountError}
              />
              <Row style={{ flexWrap: 'wrap', gap: 8 }}>
                {chips.map((a) => (
                  <Chip key={a} tone="dark" label={cop(a)} active={amount === a} onPress={() => setAmount(a)} />
                ))}
                <Chip tone="dark" label={t('drv2.wd.all', { amount: cop(withdrawable) })} active={amount === withdrawable} onPress={() => setAmount(withdrawable)} />
              </Row>
            </View>

            <Row style={{ gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: radius.md, backgroundColor: colors.limeDim }}>
              <Clock3 size={16} color={colors.lime} style={{ marginTop: 2 }} />
              <Txt v="small" color={colors.onDark} style={{ flex: 1 }}>
                {t('drv2.wd.howItWorks')}
              </Txt>
            </Row>
            {error ? (
              <Txt v="small" color={colors.danger} accessibilityLiveRegion="polite">
                {error}
              </Txt>
            ) : null}
            <Button label={t('drv2.wd.submit', { amount: cop(amount || 0) })} loading={busy} disabled={!valid} onPress={submit} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
