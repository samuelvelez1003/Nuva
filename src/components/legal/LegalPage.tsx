import React from 'react';
import { ScrollView, View } from 'react-native';
import { Href, router } from 'expo-router';
import Head from 'expo-router/head';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wordmark } from '../brand/Brand';
import { Tap } from '../ui/Button';
import { Row } from '../ui/primitives';
import { Txt } from '../ui/Txt';
import { LEGAL_UPDATED, LegalSection } from '../../lib/legal';
import { colors, radius, space } from '../../theme/tokens';

const TABS = [
  { href: '/privacidad', label: 'Política de privacidad' },
  { href: '/terminos', label: 'Términos y condiciones' },
] as const;

/** Readable legal document: narrow column, numbered sections. */
export function LegalPage({ kind, title, intro, sections }: { kind: 'privacidad' | 'terminos'; title: string; intro: string[]; sections: LegalSection[] }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ivory100 }} contentContainerStyle={{ paddingHorizontal: space[4], paddingTop: insets.top + space[6], paddingBottom: insets.bottom + 96 }}>
      <Head>
        <title>{`${title} · NÜVA`}</title>
      </Head>
      <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}>
        <Tap haptics={false} onPress={() => router.navigate('/' as Href)} accessibilityLabel="Inicio" style={{ alignSelf: 'flex-start' }}>
          <Wordmark height={26} />
        </Tap>

        <Row style={{ flexWrap: 'wrap', gap: 8, marginTop: space[8] }}>
          {TABS.map((t) => {
            const active = t.href === `/${kind}`;
            return (
              <Tap
                key={t.href}
                haptics={false}
                onPress={() => router.replace(t.href as Href)}
                accessibilityState={{ selected: active }}
                style={{ paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: active ? colors.midnight : colors.white, borderWidth: 1, borderColor: active ? colors.midnight : colors.lineLight }}
              >
                <Txt v="smallStrong" color={active ? colors.ivory : colors.ink}>
                  {t.label}
                </Txt>
              </Tap>
            );
          })}
        </Row>

        <Txt v="h1" style={{ marginTop: space[6] }}>
          {title}
        </Txt>
        <Txt v="caption" color={colors.inkMuted} style={{ marginTop: 6 }}>
          Última actualización: {LEGAL_UPDATED} · Colombia y Curaçao
        </Txt>

        <View style={{ gap: space[3], marginTop: space[6] }}>
          {intro.map((p) => (
            <Txt key={p} v="body" color={colors.inkSoft} style={{ lineHeight: 25 }}>
              {p}
            </Txt>
          ))}
        </View>

        {sections.map((s, i) => (
          <View key={s.title} style={{ marginTop: space[8], gap: space[3] }}>
            <Txt v="h3">
              {i + 1}. {s.title}
            </Txt>
            {s.list ? (
              <View style={{ gap: 10 }}>
                {s.list.map((li) => (
                  <Row key={li} style={{ alignItems: 'flex-start', gap: 10 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.midnight, marginTop: 9 }} />
                    <Txt v="body" color={colors.inkSoft} style={{ flex: 1, lineHeight: 24 }}>
                      {li}
                    </Txt>
                  </Row>
                ))}
              </View>
            ) : null}
            {(s.body ?? []).map((p) => (
              <Txt key={p} v="body" color={colors.inkSoft} style={{ lineHeight: 25 }}>
                {p}
              </Txt>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
