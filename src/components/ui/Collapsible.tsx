import React, { useMemo } from 'react';
import { GestureResponderHandlers, PanResponder, Platform, View } from 'react-native';
import { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useT } from '../../i18n';
import { colors } from '../../theme/tokens';
import { Tap } from './Button';

/** Distance (px) or speed (px/ms) of a drag on the handle that lowers or raises a panel. */
const DRAG_DIST = 48;
const DRAG_SPEED = 0.5;

/**
 * Drag a bottom panel down (to lower it to its small bar) or up (to raise it again) by
 * its handle. Works with a finger and with the mouse on the web. A tap without moving
 * toggles it too. Returns the handle's touch handlers and the panel's follow-the-finger style.
 */
export function useCollapseDrag(collapsed: boolean, setCollapsed: (c: boolean) => void) {
  const ty = useSharedValue(0);
  // Rebuilt only when the panel opens or closes (`setCollapsed` must be stable), never mid-drag.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_e, g) => {
          // Follows the finger: freely downwards while open, a short stretch upwards while lowered.
          ty.set(collapsed ? Math.max(-60, Math.min(0, g.dy * 0.45)) : Math.max(-16, g.dy));
        },
        onPanResponderRelease: (_e, g) => {
          const tap = Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6;
          if (tap) setCollapsed(!collapsed);
          else if (!collapsed && (g.dy > DRAG_DIST || g.vy > DRAG_SPEED)) setCollapsed(true);
          else if (collapsed && (g.dy < -DRAG_DIST / 2 || g.vy < -DRAG_SPEED)) setCollapsed(false);
          ty.set(tap || (!collapsed && g.dy > DRAG_DIST) ? withTiming(0, { duration: 180 }) : withSpring(0, { damping: 18, stiffness: 220 }));
        },
        onPanResponderTerminate: () => {
          ty.set(withSpring(0, { damping: 18, stiffness: 220 }));
        },
      }),
    [ty, collapsed, setCollapsed],
  );
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.get() }] }));
  return { handlers: pan.panHandlers, dragStyle };
}

/**
 * Grab bar of a collapsible panel: drag it, or tap it / the chevron button (labelled for
 * screen readers and keyboard) to lower or raise the panel.
 */
export function CollapseHandle({
  collapsed,
  onToggle,
  handlers,
  tone = 'light',
}: {
  collapsed: boolean;
  onToggle: () => void;
  handlers: GestureResponderHandlers;
  tone?: 'light' | 'dark';
}) {
  const t = useT();
  const dark = tone === 'dark';
  const Icon = collapsed ? ChevronUp : ChevronDown;
  return (
    <View style={{ height: 26, justifyContent: 'center' }}>
      <View
        {...handlers}
        collapsable={false}
        style={[
          { position: 'absolute', left: 0, right: 0, top: -10, bottom: -4, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.001)' },
          Platform.OS === 'web' && ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as object),
        ]}
      >
        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: dark ? colors.midnight500 : colors.ivory300 }} />
      </View>
      <Tap
        onPress={onToggle}
        accessibilityLabel={collapsed ? t('sheet.expand') : t('sheet.collapse')}
        hitSlop={10}
        style={{
          position: 'absolute',
          right: 14,
          top: -2,
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: dark ? colors.midnight700 : colors.ivory100,
        }}
      >
        <Icon size={17} color={dark ? colors.onDark : colors.ink} strokeWidth={2.4} />
      </Tap>
    </View>
  );
}
