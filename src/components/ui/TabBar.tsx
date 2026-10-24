import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import Animated, { LinearTransition } from 'react-native-reanimated';
import type { LucideIcon } from 'lucide-react-native';
import { TKey, useT } from '../../i18n';
import { colors, glass, radius, shadow } from '../../theme/tokens';
import { Tap } from './Button';
import { Txt } from './Txt';

/**
 * `label` is a dictionary key (e.g. `'tabs.home'`), translated here in the
 * current language. Plain text is still accepted and shown as-is.
 */
export type TabMeta = Record<string, { label: TKey | (string & {}); icon: LucideIcon }>;

/**
 * Floating pill navigation (Aurora). Passenger = white glass pill with a hairline
 * border and a soft shadow, like the mockup's nav; the active tab is a teal pill.
 * Driver (`raised`) = ink pill with the same teal active state, for dark surfaces.
 */
export function FloatingTabBar({ state, navigation, meta, tone = 'dark' }: BottomTabBarProps & { meta: TabMeta; tone?: 'dark' | 'raised' }) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const light = tone !== 'raised';
  // translate() falls back to the key itself, so literal labels pass through unchanged.
  const label = (l: string) => t(l as TKey);
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 12) + 2, alignItems: 'center' }}
    >
      <View
        accessibilityRole="tablist"
        style={[
          {
            flexDirection: 'row',
            borderRadius: radius.pill,
            padding: 6,
            gap: 2,
            borderWidth: 1,
            borderColor: light ? colors.lineLight : colors.lineDarkStrong,
          },
          light ? glass.light : { backgroundColor: colors.midnight600 },
          shadow.float,
        ]}
      >
        {state.routes.map((route, index) => {
          const m = meta[route.name];
          if (!m) return null;
          const focused = state.index === index;
          const Icon = m.icon;
          return (
            <Animated.View key={route.key} layout={LinearTransition.springify().damping(18)}>
              <Tap
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label(m.label)}
                onPress={() => {
                  const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
                }}
                style={{
                  height: 50,
                  minWidth: 54,
                  paddingHorizontal: focused ? 18 : 14,
                  borderRadius: radius.pill,
                  backgroundColor: focused ? colors.lime : 'transparent',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Icon size={21} color={focused ? colors.onLime : light ? colors.inkMuted : colors.onDarkMuted} strokeWidth={focused ? 2.5 : 2} />
                {focused ? (
                  <Txt v="smallStrong" color={colors.onLime}>
                    {label(m.label)}
                  </Txt>
                ) : null}
              </Tap>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
