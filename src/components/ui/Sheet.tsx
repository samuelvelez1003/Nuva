import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { colors, radius, shadow, space } from '../../theme/tokens';

/**
 * Floating bottom sheet used over maps. `stateKey` re-runs the entrance
 * animation whenever the sheet's content changes phase.
 */
export function Sheet({
  children,
  tone = 'light',
  stateKey,
  style,
  floating = false,
}: {
  children: React.ReactNode;
  tone?: 'light' | 'dark';
  stateKey?: string;
  style?: StyleProp<ViewStyle>;
  /** Detached card with side margins instead of an edge-to-edge sheet. */
  floating?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const dark = tone === 'dark';
  return (
    <Animated.View
      key={stateKey}
      entering={FadeInDown.springify().damping(19).stiffness(170)}
      layout={LinearTransition.springify().damping(20)}
      style={[
        {
          position: 'absolute',
          left: floating ? space[3] : 0,
          right: floating ? space[3] : 0,
          bottom: floating ? insets.bottom + space[3] : 0,
          backgroundColor: dark ? colors.midnight800 : colors.white,
          borderTopLeftRadius: radius.xxl,
          borderTopRightRadius: radius.xxl,
          borderBottomLeftRadius: floating ? radius.xxl : 0,
          borderBottomRightRadius: floating ? radius.xxl : 0,
          paddingTop: 10,
          paddingBottom: floating ? space[4] : insets.bottom + space[3],
          borderWidth: dark ? 1 : 0,
          borderColor: colors.lineDark,
        },
        shadow.float,
        style,
      ]}
    >
      <View style={{ alignItems: 'center', marginBottom: 6 }}>
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: dark ? colors.midnight500 : colors.ivory300 }} />
      </View>
      {children}
    </Animated.View>
  );
}
