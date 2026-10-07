import React, { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { colors, radius, shadow, space } from '../../theme/tokens';

/**
 * How far a bottom-anchored view must rise so the keyboard doesn't cover it.
 * On Android the window may already shrink for the keyboard ("resize"); then only
 * the part it didn't absorb is added, so the sheet never jumps twice.
 */
function useKeyboardLift() {
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const base = Dimensions.get('window').height;
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const absorbed = ios ? 0 : Math.max(0, base - Dimensions.get('window').height);
      setLift(Math.max(0, e.endCoordinates.height - absorbed));
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setLift(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return lift;
}

/**
 * Floating bottom sheet used over maps. `stateKey` re-runs the entrance
 * animation whenever the sheet's content changes phase. It rises above the
 * keyboard while one of its fields is being typed in (e.g. the boarding PIN).
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
  const lift = useKeyboardLift();
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
          bottom: lift ? lift + (floating ? space[3] : 0) : floating ? insets.bottom + space[3] : 0,
          backgroundColor: dark ? colors.midnight800 : colors.white,
          borderTopLeftRadius: radius.xxl,
          borderTopRightRadius: radius.xxl,
          borderBottomLeftRadius: floating ? radius.xxl : 0,
          borderBottomRightRadius: floating ? radius.xxl : 0,
          paddingTop: 10,
          paddingBottom: floating || lift ? space[4] : insets.bottom + space[3],
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
