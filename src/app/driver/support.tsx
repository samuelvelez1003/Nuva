import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AlertTriangle, CircleCheck, FileQuestion, Headset, MessageCircle, Phone, Receipt, Wallet } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { Card, Divider, ListRow, Row, SectionHeader } from '../../components/ui/primitives';
import { Header, Screen } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { TKey, useT } from '../../i18n';
import { useCountry } from '../../lib/country';
import { colors, space } from '../../theme/tokens';

const TOPICS: { icon: typeof Wallet; title: TKey; subtitle: TKey }[] = [
  { icon: Wallet, title: 'drv.support.walletTitle', subtitle: 'drv.support.walletSub' },
  { icon: Receipt, title: 'drv.support.tripTitle', subtitle: 'drv.support.tripSub' },
  { icon: FileQuestion, title: 'drv.support.docsTitle', subtitle: 'drv.support.docsSub' },
  { icon: AlertTriangle, title: 'drv.support.incidentTitle', subtitle: 'drv.support.incidentSub' },
];

export default function DriverSupport() {
  const t = useT();
  const { code } = useCountry();
  const [ticket, setTicket] = useState<string | null>(null);
  return (
    <Screen bg={colors.midnight} header={<Header title={t('drv.support.title')} subtitle={t('drv.support.subtitle')} large tone="dark" />}>
      <Row style={{ gap: 10 }}>
        <Button label={t('drv.support.chat')} icon={MessageCircle} size="md" full={false} style={{ flex: 1 }} onPress={() => setTicket('chat')} />
        <Button label={t('common.call')} icon={Phone} variant="outlineDark" size="md" full={false} style={{ flex: 1 }} onPress={() => setTicket('call')} />
      </Row>
      {ticket ? (
        <Animated.View entering={FadeIn}>
          <Card tone="raised" style={{ marginTop: space[4] }}>
            <Row style={{ gap: 10 }}>
              <CircleCheck size={20} color={colors.lime} />
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong" color={colors.ivory}>
                  {ticket === 'call' ? t('drv.support.callBack') : t('drv.support.received')}
                </Txt>
                <Txt v="caption" color={colors.onDarkMuted}>
                  {t('drv.support.agentSoon')}
                </Txt>
              </View>
            </Row>
          </Card>
        </Animated.View>
      ) : null}

      <SectionHeader tone="dark" title={t('drv.support.topicsTitle')} style={{ marginTop: space[6] }} />
      <Card tone="dark" padded={false} style={{ paddingHorizontal: space[4] }}>
        {TOPICS.map((topic, i) => (
          <View key={topic.title}>
            {i ? <Divider tone="dark" inset={54} /> : null}
            <ListRow
              tone="dark"
              icon={topic.icon}
              iconBg={i === 3 ? colors.danger : undefined}
              iconColor={i === 3 ? colors.white : undefined}
              title={t(topic.title)}
              subtitle={t(topic.subtitle === 'drv.support.docsSub' && code === 'CW' ? 'drv.support.docsSubCW' : topic.subtitle)}
              onPress={() => setTicket('chat')}
            />
          </View>
        ))}
      </Card>

      <Row style={{ gap: 10, marginTop: space[6] }}>
        <Headset size={16} color={colors.onDarkMuted} />
        <Txt v="caption" color={colors.onDarkMuted} style={{ flex: 1 }}>
          {t('drv.support.hours')}
        </Txt>
      </Row>
    </Screen>
  );
}
