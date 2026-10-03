import React from 'react';
import { router } from 'expo-router';
import { Info } from 'lucide-react-native';
import { Button } from '../ui/Button';
import { Card, KeyValue, Row } from '../ui/primitives';
import { Header, Screen } from '../ui/Screen';
import { Txt } from '../ui/Txt';
import { useT } from '../../i18n';
import { useAuth } from '../../store/Auth';
import { colors, radius, space } from '../../theme/tokens';

/**
 * Live mode: a real driver's own vehicle and documents, as registered at sign-up
 * and reviewed by NÜVA. Read-only — changes go through support, so a document
 * can't be swapped after approval without a new review.
 */
export function DriverData({ kind }: { kind: 'documents' | 'vehicle' }) {
  const t = useT();
  const { profile } = useAuth();
  const v = profile?.vehicle;
  const cw = profile?.country === 'CW';
  const date = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '—');

  return (
    <Screen bg={colors.midnight} header={<Header title={kind === 'documents' ? t('auth.docs.title') : t('common.vehicle')} tone="dark" />}>
      {kind === 'vehicle' ? (
        <Card tone="dark">
          <KeyValue tone="dark" label={t('common.vehicle')} value={[v?.brand, v?.model].filter(Boolean).join(' ') || '—'} />
          <KeyValue tone="dark" label={t('common.plate')} value={v?.plate ?? '—'} />
          {v?.color ? <KeyValue tone="dark" label={t('drv.data.color')} value={v.color} /> : null}
        </Card>
      ) : (
        <Card tone="dark">
          <KeyValue tone="dark" label={t('common.name')} value={profile?.full_name || '—'} />
          {cw ? (
            <>
              <KeyValue tone="dark" label={t('drv.pending.license')} value={v?.license ?? '—'} />
              <KeyValue tone="dark" label={t('drv.pending.insurance')} value={date(v?.insuranceUntil)} />
              <KeyValue tone="dark" label={t('drv.pending.bank')} value={profile?.payout?.bank ?? '—'} />
            </>
          ) : (
            <KeyValue tone="dark" label={t('drv.pending.nequi')} value={profile?.payout?.nequi ?? '—'} />
          )}
          <KeyValue tone="dark" label={t('drv.data.status')} value={profile?.role === 'admin' ? t('drv.data.admin') : profile?.driver_status === 'aprobado' ? t('drv.docs.stApproved') : t('drv.docs.stReview')} />
        </Card>
      )}

      <Row style={{ gap: 10, alignItems: 'flex-start', marginTop: space[4], padding: 14, borderRadius: radius.md, backgroundColor: colors.limeDim }}>
        <Info size={16} color={colors.lime} style={{ marginTop: 2 }} />
        <Txt v="small" color={colors.onDark} style={{ flex: 1 }}>
          {t('drv.data.changeHint')}
        </Txt>
      </Row>
      <Button label={t('drv.support.title')} variant="outlineDark" size="md" style={{ marginTop: space[4] }} onPress={() => router.push('/driver/support')} />
    </Screen>
  );
}
