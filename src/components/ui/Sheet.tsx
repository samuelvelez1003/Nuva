import React, { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { colors, radius, shadow, space } from '../../theme/tokens';
import { useT } from '../../i18n';
import { Tap } from './Button';
import { CollapseHandle, useCollapseDrag } from './Collapsible';
import { Txt } from './Txt';

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
 *
 * `collapsible`: the sheet can be lowered to a small bar (handle + `summary`) so the
 * map behind it is visible and movable, and raised again — by dragging the handle
 * (finger or mouse), tapping it, or the chevron button. A new `stateKey` raises it.
 */
export function Sheet({
  children,
  tone = 'light',
  stateKey,
  style,
  floating = false,
  collapsible = false,
  summary,
  onHeight,
}: {
  children: React.ReactNode;
  tone?: 'light' | 'dark';
  stateKey?: string;
  style?: StyleProp<ViewStyle>;
  /** Detached card with side margins instead of an edge-to-edge sheet. */
  floating?: boolean;
  collapsible?: boolean;
  /** One line shown in the lowered bar (e.g. destination · price). */
  summary?: React.ReactNode;
  /** Space the sheet takes from the bottom of the screen (px), on every size change. */
  onHeight?: (h: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const lift = useKeyboardLift();
  const t = useT();
  const dark = tone === 'dark';
  // Lowered for one step only: a new phase or step (`stateKey`) always opens raised,
  // since it may need the passenger's attention.
  const [collapsed, setCollapsed] = useState(false);
  const [seenKey, setSeenKey] = useState(stateKey);
  if (seenKey !== stateKey) {
    setSeenKey(stateKey);
    setCollapsed(false);
  }
  const isCollapsed = collapsible && collapsed && !lift;
  const drag = useCollapseDrag(isCollapsed, setCollapsed);
  const bottom = lift ? lift + (floating ? space[3] : 0) : floating ? insets.bottom + space[3] : 0;
  return (
    <Animated.View
      key={stateKey}
      entering={FadeInDown.springify().damping(19).stiffness(170)}
      layout={LinearTransition.springify().damping(20)}
      // The keyboard's lift isn't counted: the map shouldn't reframe while typing.
      onLayout={onHeight ? (e) => onHeight(Math.round(e.nativeEvent.layout.height + (floating ? insets.bottom + space[3] : 0))) : undefined}
      style={[{ position: 'absolute', left: floating ? space[3] : 0, right: floating ? space[3] : 0, bottom }, style]}
    >
      <Animated.View
        style={[
          {
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
          collapsible ? drag.dragStyle : null,
        ]}
      >
        {collapsible ? (
          <CollapseHandle collapsed={isCollapsed} onToggle={() => setCollapsed(!isCollapsed)} handlers={drag.handlers} tone={tone} />
        ) : (
          <View style={{ alignItems: 'center', marginBottom: 6 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: dark ? colors.midnight500 : colors.ivory300 }} />
          </View>
        )}
        {isCollapsed ? (
          <Tap
            onPress={() => setCollapsed(false)}
            scaleTo={0.99}
            accessibilityLabel={t('sheet.expand')}
            style={{ paddingHorizontal: space[5], minHeight: 40, justifyContent: 'center' }}
          >
            {typeof summary === 'string' || !summary ? (
              <Txt v="bodyStrong" numberOfLines={1} color={dark ? colors.ivory : colors.ink}>
                {summary || t('sheet.expand')}
              </Txt>
            ) : (
              summary
            )}
          </Tap>
        ) : null}
        {/* Hidden, not unmounted, while lowered: typed text and scroll positions survive. */}
        <View style={isCollapsed ? { display: 'none' } : undefined}>{children}</View>
      </Animated.View>
    </Animated.View>
  );
}
