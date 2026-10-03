import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../store/Auth';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { BrandRings, Wordmark, WORDMARK } from '../../components/brand/Brand';

const MARK_H = 72;
import { useStatusTone } from '../../components/ui/Screen';
import { Txt } from '../../components/ui/Txt';
import { useT } from '../../i18n';
import { useApp } from '../../store/AppStore';
import { colors } from '../../theme/tokens';

/** Splash: the wordmark rises, the tagline lands word by word, then we route. */
export default function Splash() {
  const { passengerAuthed } = useApp();
  const auth = useAuth();
  const t = useT();
  const signedIn = auth.live ? !!auth.session : passengerAuthed;
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;
  useStatusTone('light');
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

  // Destination dot travels from the origin ring along an arc and lands.
  const k = MARK_H / WORDMARK.vbH;
  const { origin: or, destination: de } = WORDMARK;
  const dotSize = de.r * 2 * k;
  const dot = useAnimatedStyle(() => {
    const p = trip.value;
    const ux = or.x + (de.x - or.x) * p;
    const uy = or.y - Math.sin(p * Math.PI) * 26;
    return {
      opacity: p > 0.02 ? 1 : 0,
      transform: [
        { translateX: (ux - WORDMARK.vbX) * k - dotSize / 2 },
        { translateY: (uy - WORDMARK.vbY) * k - dotSize / 2 },
        { scale: 0.55 + 0.45 * p },
      ],
    };
  });
  const progress = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', opacity: 0.8 }} pointerEvents="none">
        <BrandRings size={560} />
      </View>
      <Animated.View style={mark}>
        <Wordmark height={MARK_H} color={colors.ivory} hideDestination route />
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: colors.lime }, dot]} />
      </Animated.View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 26 }}>
        {[t('common.tagline.city'), t('common.tagline.rhythm'), t('common.tagline.price')].map((w, i) => (
          <Animated.View key={w} entering={FadeIn.delay(600 + i * 260).duration(400)}>
            <Txt v="bodyStrong" color={i === 2 ? colors.lime : colors.onDarkMuted}>
              {w}
            </Txt>
          </Animated.View>
        ))}
      </View>
      <View style={{ position: 'absolute', bottom: 80, width: 120, height: 3, borderRadius: 2, backgroundColor: colors.midnight500, overflow: 'hidden' }}>
        <Animated.View style={[{ height: 3, backgroundColor: colors.lime }, progress]} />
      </View>
    </View>
  );
}
