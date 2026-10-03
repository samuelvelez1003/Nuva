import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Power } from 'lucide-react-native';
import { useT } from '../../i18n';
import { colors, radius } from '../../theme/tokens';
import { haptic, Tap } from './Button';
import { LiveDot } from './primitives';
import { Txt } from './Txt';

const H = 76;
const KNOB = 64;

/** The driver's single most important control: go online / offline. */
export function OnlineToggle({ online, onChange }: { online: boolean; onChange: (v: boolean) => void }) {
  const t = useT();
  const [w, setW] = useState(0);
  const x = useSharedValue(online ? 1 : 0);
  useEffect(() => {
    x.value = withSpring(online ? 1 : 0, { damping: 17, stiffness: 180 });
  }, [online, x]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(x.value, [0, 1], [colors.midnight600, colors.lime]),
  }));
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * Math.max(0, w - KNOB - 12) }],
    backgroundColor: interpolateColor(x.value, [0, 1], [colors.midnight400, colors.midnight]),
  }));
  const offLabel = useAnimatedStyle(() => ({ opacity: withTiming(online ? 0 : 1, { duration: 160 }) }));
  const onLabel = useAnimatedStyle(() => ({ opacity: withTiming(online ? 1 : 0, { duration: 160 }) }));

  return (
    <Tap
      onPress={() => {
        haptic(online ? 'light' : 'success');
        onChange(!online);
      }}
      scaleTo={0.98}
      accessibilityRole="switch"
      accessibilityState={{ checked: online }}
      accessibilityLabel={online ? t('drv.toggle.onlineA11y') : t('drv.toggle.offlineA11y')}
    >
      <Animated.View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={[{ height: H, borderRadius: radius.pill, justifyContent: 'center', padding: 6 }, track]}>
        <Animated.View style={[{ position: 'absolute', left: KNOB + 26, right: 20 }, offLabel]} pointerEvents="none">
          <Txt v="title" color={colors.ivory}>
            {t('drv.toggle.offline')}
          </Txt>
          <Txt v="caption" color={colors.onDarkMuted}>
            {t('drv.toggle.offlineSub')}
          </Txt>
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', left: 26, right: KNOB + 26, flexDirection: 'row', alignItems: 'center', gap: 10 }, onLabel]} pointerEvents="none">
          <LiveDot color={colors.midnight} size={9} />
          <View>
            <Txt v="title" color={colors.midnight}>
              {t('drv.toggle.online')}
            </Txt>
            <Txt v="caption" color={colors.midnight800} style={{ opacity: 0.75 }}>
              {t('drv.toggle.onlineSub')}
            </Txt>
          </View>
        </Animated.View>
        <Animated.View style={[{ width: KNOB, height: KNOB, borderRadius: KNOB / 2, alignItems: 'center', justifyContent: 'center' }, knob]}>
          <Power size={26} color={online ? colors.lime : colors.ivory} strokeWidth={2.6} />
        </Animated.View>
      </Animated.View>
    </Tap>
  );
}
