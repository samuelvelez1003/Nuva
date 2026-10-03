import React from 'react';
import { Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { router, usePathname, Href } from 'expo-router';
import { ArrowUpRight, LayoutGrid } from 'lucide-react-native';
import { colors, radius, space } from '../../theme/tokens';
import { Wordmark } from '../brand/Brand';
import { Tap } from '../ui/Button';
import { Row } from '../ui/primitives';
import { StatusToneProvider, ToastProvider, useStatusToneValue } from '../ui/Screen';
import { Txt } from '../ui/Txt';

export interface ScreenGroup {
  title: string;
  items: { label: string; href: string }[];
}

const PHONE_W = 390;
const PHONE_H = 844;
const INSETS = { top: 54, bottom: 26, left: 0, right: 0 };

function StatusBarMock() {
  const tone = useStatusToneValue();
  const c = tone === 'light' ? colors.white : colors.ink;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 50, zIndex: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 34, paddingTop: 6 }}>
      <Txt v="smallStrong" color={c} style={{ fontSize: 15, width: 54 }}>
        9:41
      </Txt>
      <View style={{ width: 118, height: 34, borderRadius: 20, backgroundColor: '#000' }} />
      <Row style={{ gap: 5, width: 54, justifyContent: 'flex-end' }}>
        <Row style={{ alignItems: 'flex-end', gap: 1.5 }}>
          {[4, 6, 8, 10].map((h) => (
            <View key={h} style={{ width: 3, height: h, borderRadius: 1, backgroundColor: c }} />
          ))}
        </Row>
        <View style={{ width: 22, height: 11, borderRadius: 3.5, borderWidth: 1.2, borderColor: c, padding: 1.2, opacity: 0.95 }}>
          <View style={{ flex: 1, width: '78%', borderRadius: 1.5, backgroundColor: c }} />
        </View>
      </Row>
    </View>
  );
}

function HomeIndicator() {
  const tone = useStatusToneValue();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', bottom: 8, left: 0, right: 0, alignItems: 'center', zIndex: 50 }}>
      <View style={{ width: 134, height: 5, borderRadius: 3, backgroundColor: tone === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(16,20,17,0.85)' }} />
    </View>
  );
}

function ScreenIndex({ groups }: { groups: ScreenGroup[] }) {
  const path = usePathname();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {groups.map((g) => (
        <View key={g.title} style={{ marginBottom: space[5] }}>
          <Txt v="overline" color={colors.onDarkFaint} style={{ marginBottom: 8 }}>
            {g.title}
          </Txt>
          {g.items.map((it) => {
            const active = path === it.href;
            return (
              <Tap key={it.href + it.label} haptics={false} scaleTo={0.98} onPress={() => router.navigate(it.href as Href)}>
                <Row style={{ paddingVertical: 7, gap: 10 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: active ? colors.lime : colors.midnight500 }} />
                  <Txt v="small" color={active ? colors.lime : colors.onDarkMuted} weight={active ? 'bold' : 'medium'}>
                    {it.label}
                  </Txt>
                </Row>
              </Tap>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * On native: transparent. On a wide web viewport: presents the app inside a
 * device frame with a navigable screen index — the prototype "stage".
 */
export function PhoneFrame({
  children,
  app,
  description,
  groups,
  initialTone = 'dark',
}: {
  children: React.ReactNode;
  app: string;
  description: string;
  groups: ScreenGroup[];
  initialTone?: 'dark' | 'light';
}) {
  const { width, height } = useWindowDimensions();
  const staged = Platform.OS === 'web' && width >= 760;

  if (!staged) {
    return (
      <StatusToneProvider initial={initialTone}>
        <ToastProvider>{children}</ToastProvider>
      </StatusToneProvider>
    );
  }

  const phoneH = Math.min(PHONE_H, height - 40);
  const showSides = width >= 1100;

  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight900, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 56, paddingHorizontal: 32 }}>
      {showSides ? (
        <View style={{ width: 280, height: phoneH, paddingTop: 12, justifyContent: 'space-between' }}>
          <View>
            <Tap haptics={false} onPress={() => router.navigate('/')} accessibilityLabel="Volver al inicio del prototipo" style={{ alignSelf: 'flex-start' }}>
              <Wordmark height={30} color={colors.ivory} />
            </Tap>
            <Txt v="h2" color={colors.ivory} style={{ marginTop: 28 }}>
              {app}
            </Txt>
            <Txt v="body" color={colors.onDarkMuted} style={{ marginTop: 10 }}>
              {description}
            </Txt>
          </View>
          <View style={{ gap: 10 }}>
            <Txt v="overline" color={colors.onDarkFaint}>
              Ecosistema NÜVA
            </Txt>
            {[
              { label: 'Pasajero', href: '/passenger/home' },
              { label: 'Conductor', href: '/driver/home' },
              { label: 'Admin', href: '/admin' },
              { label: 'Sistema de diseño', href: '/design' },
            ].map((l) => (
              <Tap key={l.href} haptics={false} onPress={() => router.navigate(l.href as Href)}>
                <Row style={{ justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.lineDark }}>
                  <Txt v="bodyStrong" color={app.includes(l.label) ? colors.lime : colors.ivory}>
                    {l.label}
                  </Txt>
                  <ArrowUpRight size={16} color={colors.onDarkMuted} />
                </Row>
              </Tap>
            ))}
          </View>
        </View>
      ) : null}

      <View
        style={[
          {
            width: PHONE_W + 24,
            height: phoneH + 24,
            borderRadius: 64,
            padding: 12,
            backgroundColor: '#050605',
            borderWidth: 1,
            borderColor: '#2A302B',
          },
          { boxShadow: '0 60px 120px -40px rgba(212,255,95,0.18), 0 40px 80px -30px rgba(0,0,0,0.8)' } as object,
        ]}
      >
        <View style={{ flex: 1, borderRadius: 52, overflow: 'hidden', backgroundColor: colors.ivory }}>
          <StatusToneProvider initial={initialTone}>
            <SafeAreaInsetsContext.Provider value={INSETS}>
              <ToastProvider top={58}>{children}</ToastProvider>
            </SafeAreaInsetsContext.Provider>
            <StatusBarMock />
            <HomeIndicator />
          </StatusToneProvider>
        </View>
      </View>

      {showSides ? (
        <View style={{ width: 240, height: phoneH, paddingTop: 12 }}>
          <Row style={{ gap: 8, marginBottom: 18 }}>
            <LayoutGrid size={16} color={colors.lime} />
            <Txt v="smallStrong" color={colors.ivory}>
              Pantallas
            </Txt>
          </Row>
          <View style={{ flex: 1, borderRadius: radius.lg }}>
            <ScreenIndex groups={groups} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
