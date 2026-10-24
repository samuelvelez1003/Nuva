import React from 'react';
import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { X } from 'lucide-react-native';
import { IconButton } from '../ui/Button';
import { Row } from '../ui/primitives';
import { Txt } from '../ui/Txt';
import { useT } from '../../i18n';
import { CUSTOMER_URL } from '../../lib/site';
import { colors, space } from '../../theme/tokens';

const RETURN = `${CUSTOMER_URL}/pago`;

/**
 * Native app: Wompi's hosted checkout in a full-screen sheet. When Wompi sends the
 * passenger back to CUSTOMER_URL/pago, the sheet closes and hands that address (with
 * Wompi's ?id=<transaction>) to `onReturn`.
 */
export function CheckoutSheet({ url, onReturn, onClose }: { url: string | null; onReturn: (returnUrl: string) => void; onClose: () => void }) {
  const t = useT();
  const intercept = (next: string) => {
    if (!next.startsWith(RETURN)) return true;
    onReturn(next);
    return false;
  };
  return (
    <Modal visible={!!url} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: space[4], paddingVertical: space[2] }}>
          <Txt v="title">{t('pax.cardpay.title')}</Txt>
          <IconButton icon={X} label={t('pax.cardpay.close')} onPress={onClose} />
        </Row>
        <View style={{ flex: 1 }}>
          {url ? <WebView source={{ uri: url }} onShouldStartLoadWithRequest={(r) => intercept(r.url)} startInLoadingState sharedCookiesEnabled /> : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
