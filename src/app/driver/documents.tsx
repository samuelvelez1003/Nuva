import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { CircleCheck, Clock, FileText, TriangleAlert, Upload } from 'lucide-react-native';
import { Button, Tap } from '../../components/ui/Button';
import { Badge, ProgressBar, Row } from '../../components/ui/primitives';
import { Header, Screen, useToast } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { TKey, TVars, useT } from '../../i18n';
import { DriverData } from '../../components/driver/DriverData';
import { useApp } from '../../store/AppStore';
import { useAuth } from '../../store/Auth';
import { colors, radius, space } from '../../theme/tokens';

type Status = 'aprobado' | 'por-vencer' | 'en-revision' | 'pendiente' | 'subiendo';

// Sample documents of the demo driver (texts are dictionary keys + values).
const INITIAL: { id: string; name: TKey; detail: TKey; vars?: TVars; status: Status }[] = [
  { id: 'cc', name: 'drv.docs.cc', detail: 'drv.docs.ccDetail', status: 'aprobado' },
  { id: 'lic', name: 'drv.docs.license', detail: 'drv.docs.expires', vars: { date: '14/03/2029' }, status: 'aprobado' },
  { id: 'soat', name: 'drv.docs.soat', detail: 'drv.docs.soatDetail', vars: { days: 9, date: '11/10' }, status: 'por-vencer' },
  { id: 'tecno', name: 'drv.docs.tecno', detail: 'drv.docs.sentYesterday', status: 'en-revision' },
  { id: 'tp', name: 'drv.docs.ownership', detail: 'drv.docs.ownerDetail', vars: { name: 'Camilo Herrera' }, status: 'aprobado' },
  { id: 'ant', name: 'drv.docs.background', detail: 'drv.docs.backgroundDetail', status: 'aprobado' },
  { id: 'rc', name: 'drv.docs.liability', detail: 'drv.docs.liabilityDetail', status: 'pendiente' },
];

const META: Record<Status, { label: TKey; tone: 'ghostDark' | 'warning' | 'info' | 'lime' | 'neutral'; icon: typeof CircleCheck; color: string }> = {
  aprobado: { label: 'drv.docs.stApproved', tone: 'ghostDark', icon: CircleCheck, color: colors.lime },
  'por-vencer': { label: 'drv.docs.stExpiring', tone: 'warning', icon: TriangleAlert, color: colors.warning },
  'en-revision': { label: 'drv.docs.stReview', tone: 'info', icon: Clock, color: colors.info },
  pendiente: { label: 'drv.docs.stPending', tone: 'ghostDark', icon: FileText, color: colors.onDarkMuted },
  subiendo: { label: 'drv.docs.stUploading', tone: 'lime', icon: Upload, color: colors.lime },
};

export default function DocumentStatus() {
  const { live } = useAuth();
  // A real driver sees their own registered documents, never the demo driver's.
  return live ? <DriverData kind="documents" /> : <DemoDocumentStatus />;
}

/** Demo walkthrough (no backend). */
function DemoDocumentStatus() {
  const toast = useToast();
  const t = useT();
  const { setDriverOnboarded } = useApp();
  const [docs, setDocs] = useState(INITIAL);
  const approved = docs.filter((d) => d.status === 'aprobado').length;
  const required = docs.filter((d) => d.id !== 'rc');
  const ready = required.every((d) => d.status === 'aprobado' || d.status === 'en-revision');

  const upload = (id: string) => {
    setDocs((l) => l.map((d) => (d.id === id ? { ...d, status: 'subiendo' } : d)));
    setTimeout(() => {
      setDocs((l) => l.map((d) => (d.id === id ? { ...d, status: 'en-revision', detail: 'drv.docs.receivedDetail', vars: undefined } : d)));
      toast(t('drv.docs.received'));
    }, 1400);
  };

  return (
    <Screen
      bg={colors.midnight}
      header={<Header title={t('auth.docs.title')} tone="dark" large subtitle={t('drv.docs.subtitle')} />}
      footer={
        <Button
          label={ready ? t('drv.docs.goPanel') : t('drv.docs.completePending')}
          disabled={!ready}
          onPress={() => {
            setDriverOnboarded(true);
            router.replace('/driver/home');
          }}
        />
      }
    >
      <View style={{ padding: space[5], borderRadius: radius.xl, backgroundColor: colors.midnight700, borderWidth: 1, borderColor: colors.lineDark }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Txt v="title" color={colors.ivory}>
            {t('drv.docs.approvedOf', { n: approved, total: docs.length })}
          </Txt>
          <Txt v="caption" color={colors.onDarkMuted}>
            {t('drv.docs.accountActive')}
          </Txt>
        </Row>
        <ProgressBar value={approved / docs.length} tone="dark" />
      </View>

      <View style={{ marginTop: space[5], gap: 10 }}>
        {docs.map((d) => {
          const m = META[d.status];
          const actionable = d.status === 'por-vencer' || d.status === 'pendiente';
          return (
            <View key={d.id} style={{ padding: 16, borderRadius: radius.lg, backgroundColor: colors.midnight700, borderWidth: 1, borderColor: d.status === 'por-vencer' ? 'rgba(255,181,71,0.4)' : colors.lineDark }}>
              <Row style={{ gap: 12 }}>
                {d.status === 'subiendo' ? <ActivityIndicator color={colors.lime} /> : <m.icon size={20} color={m.color} />}
                <View style={{ flex: 1 }}>
                  <Txt v="bodyStrong" color={colors.ivory}>
                    {t(d.name)}
                  </Txt>
                  <Txt v="caption" color={colors.onDarkMuted}>
                    {t(d.detail, d.vars)}
                  </Txt>
                </View>
                <Badge label={t(m.label)} tone={m.tone} />
              </Row>
              {actionable ? (
                <Tap onPress={() => upload(d.id)} style={{ marginTop: 12, height: 40, borderRadius: radius.pill, borderWidth: 1.5, borderColor: d.status === 'por-vencer' ? colors.warning : colors.lineDarkStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Upload size={15} color={d.status === 'por-vencer' ? colors.warning : colors.ivory} />
                  <Txt v="smallStrong" color={d.status === 'por-vencer' ? colors.warning : colors.ivory}>
                    {d.status === 'por-vencer' ? t('drv.docs.uploadSoat') : t('drv.docs.upload')}
                  </Txt>
                </Tap>
              ) : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
