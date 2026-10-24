import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Lock, X } from 'lucide-react-native';
import { Button, IconButton, Tap } from '../ui/Button';
import { Field, Row } from '../ui/primitives';
import { Txt } from '../ui/Txt';
import { useT } from '../../i18n';
import { SavedCard, saveCard, WompiConfig } from '../../lib/wompi';
import { colors, radius, space } from '../../theme/tokens';

const groups = (v: string) => v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
const expiry = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

function Consent({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <Tap onPress={onToggle} haptics={false} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.midnight, backgroundColor: checked ? colors.midnight : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
          {checked ? <Check size={14} color={colors.lime} strokeWidth={3} /> : null}
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </Row>
    </Tap>
  );
}

/** Wallet: add a card. Its data goes from this form straight to Wompi, never to our server. */
export function AddCardSheet({ visible, config, onClose, onSaved }: { visible: boolean; config: WompiConfig; onClose: () => void; onSaved: (card: SavedCard) => void }) {
  const t = useT();
  const [number, setNumber] = useState('');
  const [holder, setHolder] = useState('');
  const [exp, setExp] = useState('');
  const [cvc, setCvc] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const digits = number.replace(/\D/g, '');
  const [mm, yy] = exp.split('/');
  const month = Number(mm);
  const valid = digits.length >= 13 && holder.trim().length >= 3 && month >= 1 && month <= 12 && (yy ?? '').length === 2 && cvc.length >= 3 && terms;

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const card = await saveCard({ number: digits, holder, expMonth: mm, expYear: yy, cvc }, config);
      setNumber('');
      setHolder('');
      setExp('');
      setCvc('');
      setTerms(false);
      onSaved(card);
    } catch (e) {
      setError(e instanceof Error && e.message !== 'card' && e.message !== 'Wompi' ? e.message : t('cards.invalid'));
    } finally {
      setBusy(false);
    }
  };

  const link = (url?: string | null) => (url ? () => Linking.openURL(url).catch(() => undefined) : undefined);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={Platform.OS === 'web'}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.ivory100 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: space[4], paddingVertical: space[2] }}>
            <Txt v="h3">{t('cards.addTitle')}</Txt>
            <IconButton icon={X} label={t('cards.close')} onPress={onClose} />
          </Row>
          <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], maxWidth: 480, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
            <Field label={t('cards.number')} value={groups(number)} onChangeText={setNumber} keyboardType="number-pad" autoComplete="cc-number" textContentType="creditCardNumber" placeholder="4242 4242 4242 4242" />
            <Field label={t('cards.holder')} value={holder} onChangeText={setHolder} autoCapitalize="characters" autoComplete="name" placeholder={t('cards.holderPh')} />
            <Row style={{ gap: space[3] }}>
              <Field style={{ flex: 1 }} label={t('cards.expiry')} value={exp} onChangeText={(v) => setExp(expiry(v))} keyboardType="number-pad" placeholder="MM/AA" maxLength={5} />
              <Field style={{ flex: 1 }} label="CVV" value={cvc} onChangeText={(v) => setCvc(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry placeholder="123" maxLength={4} />
            </Row>
            <Consent checked={terms} onToggle={() => setTerms((v) => !v)}>
              <Txt v="small" color={colors.inkSoft}>
                {t('cards.consent')}{' '}
                <Txt v="smallStrong" style={{ textDecorationLine: 'underline' }} onPress={link(config.termsUrl)}>
                  {t('cards.terms')}
                </Txt>{' '}
                ·{' '}
                <Txt v="smallStrong" style={{ textDecorationLine: 'underline' }} onPress={link(config.personalAuthUrl)}>
                  {t('cards.data')}
                </Txt>
              </Txt>
            </Consent>
            <Row style={{ gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: radius.md, backgroundColor: colors.ivory200 }}>
              <Lock size={16} color={colors.inkSoft} style={{ marginTop: 2 }} />
              <Txt v="caption" color={colors.inkSoft} style={{ flex: 1 }}>
                {t('cards.secure')}
              </Txt>
            </Row>
            {!config.live ? (
              <Txt v="caption" color={colors.warningInk}>
                {t('cards.testHint')}
              </Txt>
            ) : null}
            {error ? (
              <Txt v="small" color={colors.dangerInk} accessibilityLiveRegion="polite">
                {error}
              </Txt>
            ) : null}
            <Button label={t('cards.save')} variant="dark" loading={busy} disabled={!valid} onPress={submit} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
