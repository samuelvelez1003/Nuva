import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../store/Auth';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Aurora } from '../../components/brand/Aurora';
import { LogoMark } from '../../components/brand/Brand';
import { useStatusTone } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { useT } from '../../i18n';
import { useApp } from '../../store/AppStore';
import { colors, fonts, shadow } from '../../theme/tokens';

/** Splash: the wordmark rises, the tagline lands word by word, then we route. */
export default function Splash() {
  const { passengerAuthed } = useApp();
  const auth = useAuth();
  const t = useT();
  const signedIn = auth.live ? !!auth.session : passengerAuthed;
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;
  useStatusTone('dark');
  const y = useSharedValue(24);
  const o = useSharedValue(0);
  const bar = useSharedValue(0);
  const trip = useSharedValue(0);

  useEffect(() => {
    y.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) });
    o.value = withTiming(1, { duration: 700 });
    bar.value = withDelay(500, withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) }));
    trip.value = withDelay(450, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
    // Read the latest auth state when the splash ends (the session may load meanwhile).
    const id = setTimeout(() => router.replace(signedInRef.current ? '/passenger/home' : '/passenger/onboarding'), 2300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mark = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));

  // The violet destination square lands on the tile.
  const dot = useAnimatedStyle(() => ({ opacity: trip.value > 0.02 ? 1 : 0, transform: [{ scale: 0.4 + 0.6 * trip.value }] }));
  const progress = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.ivory100, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Aurora layout="app" scale={1.3} />
      <Animated.View style={[{ alignItems: 'center', gap: 14 }, mark]} accessible accessibilityRole="image" accessibilityLabel="NÜVA">
        <View>
          <LogoMark size={84} style={shadow.soft} />
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 15, right: 18, width: 11, height: 11, borderRadius: 3, backgroundColor: colors.coral }, dot]} />
        </View>
        <Txt style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: 3 }} color={colors.ink}>
          NÜVA
        </Txt>
      </Animated.View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 26 }}>
        {[t('common.tagline.city'), t('common.tagline.rhythm'), t('common.tagline.price')].map((w, i) => (
          <Animated.View key={w} entering={FadeIn.delay(600 + i * 260).duration(400)}>
            <Txt v="bodyStrong" color={i === 2 ? colors.limeInk : colors.inkSoft}>
              {w}
            </Txt>
          </Animated.View>
        ))}
      </View>
      <View style={{ position: 'absolute', bottom: 80, width: 120, height: 3, borderRadius: 2, backgroundColor: colors.ivory300, overflow: 'hidden' }}>
        <Animated.View style={[{ height: 3, backgroundColor: colors.lime }, progress]} />
      </View>
    </View>
  );
}
