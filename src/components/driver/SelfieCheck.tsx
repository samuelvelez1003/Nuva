import React, { useState } from 'react';
import { Modal, View } from 'react-native';
import { Camera, ScanFace, Sun } from 'lucide-react-native';
import { Button } from '../ui/Button';
import { Row } from '../ui/primitives';
import { useToast } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { useT } from '../../i18n';
import { takeIdentitySelfie } from '../../lib/selfie';
import { useAuth } from '../../store/Auth';
import { colors, radius, space } from '../../theme/tokens';

/**
 * Identity check before taking trips: every N hours (admin setting) the driver takes a
 * selfie with the front camera; NÜVA compares it with their profile photo. Shown when
 * going online, and when accepting a trip is refused because the selfie is due.
 */
export function SelfieCheck({ visible, hours, onClose, onDone }: { visible: boolean; hours?: number; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const toast = useToast();
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const take = async () => {
    if (!session) return;
    setBusy(true);
    setError(undefined);
    try {
      const at = await takeIdentitySelfie(session.user.id);
      if (!at) return; // cancelled in the camera
      toast(t('drv2.selfie.done'), 'success');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end', alignItems: 'center' }}>
        <View
          style={{
            width: '100%',
            maxWidth: 520,
            backgroundColor: colors.midnight800,
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
            borderWidth: 1,
            borderColor: colors.lineDark,
            padding: space[6],
            paddingBottom: space[8],
            gap: space[4],
          }}
        >
          <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }}>
            <ScanFace size={32} color={colors.onLime} />
          </View>
          <View style={{ gap: 6 }}>
            <Txt v="overline" color={colors.limeOnDark}>
              {t('drv2.selfie.kicker')}
            </Txt>
            <Txt v="h2" color={colors.ivory}>
              {t('drv2.selfie.title')}
            </Txt>
            <Txt v="body" color={colors.onDarkMuted}>
              {t('drv2.selfie.body')}
            </Txt>
          </View>
          <Row style={{ gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: radius.md, backgroundColor: colors.midnight700 }}>
            <Sun size={16} color={colors.limeOnDark} style={{ marginTop: 2 }} />
            <Txt v="small" color={colors.onDark} style={{ flex: 1 }}>
              {t('drv2.selfie.tips')}
              {hours ? ` ${t('drv2.selfie.every', { n: hours })}` : ''}
            </Txt>
          </Row>
          {error ? (
            <Txt v="small" color={colors.dangerOnDark} accessibilityLiveRegion="polite">
              {error}
            </Txt>
          ) : null}
          <Button label={t('drv2.selfie.take')} icon={Camera} loading={busy} onPress={take} />
          <Button label={t('drv2.selfie.later')} variant="outlineDark" size="md" disabled={busy} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
