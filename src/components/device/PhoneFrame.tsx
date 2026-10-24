import React from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { colors } from '../../theme/tokens';
import { Row } from '../ui/primitives';
import { StatusToneProvider, ToastProvider, useStatusToneValue } from '../ui/Screen';
import { Txt } from '../ui/Txt';

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

/**
 * On native and narrow screens: transparent. On a wide web viewport the mobile app is
 * shown centred inside a phone-sized frame, so it keeps its mobile layout.
 */
export function PhoneFrame({ children, initialTone = 'dark' }: { children: React.ReactNode; initialTone?: 'dark' | 'light' }) {
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight900, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
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
    </View>
  );
}
