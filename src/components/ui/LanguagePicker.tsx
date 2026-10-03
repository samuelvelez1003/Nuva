import React from 'react';
import { View } from 'react-native';
import { Globe } from 'lucide-react-native';
import { LANGS, useLanguage } from '../../i18n';
import { colors, radius } from '../../theme/tokens';
import { Tap } from './Button';
import { Row } from './primitives';
import { Txt } from './Txt';

/** ES · EN · PAP switch. `tone="dark"` for midnight backgrounds, `"lime"` for lime ones. */
export function LanguagePicker({ tone = 'dark', compact }: { tone?: 'dark' | 'light' | 'lime'; compact?: boolean }) {
  const { lang, setLang } = useLanguage();
  const fg = tone === 'dark' ? colors.onDarkMuted : colors.inkMuted;
  const activeBg = tone === 'lime' ? colors.midnight : tone === 'dark' ? colors.lime : colors.midnight;
  const activeFg = tone === 'lime' ? colors.lime : tone === 'dark' ? colors.midnight : colors.lime;
  return (
    <Row
      style={{
        gap: 2,
        padding: 3,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: tone === 'dark' ? colors.lineDarkStrong : 'rgba(16,20,17,0.18)',
      }}
      accessibilityRole="radiogroup"
      accessibilityLabel="Idioma"
    >
      {compact ? null : (
        <View style={{ paddingLeft: 6, paddingRight: 2 }}>
          <Globe size={14} color={fg} />
        </View>
      )}
      {LANGS.map((l) => {
        const active = l.code === lang;
        return (
          <Tap
            key={l.code}
            haptics={false}
            onPress={() => setLang(l.code)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={l.label}
            style={{ height: 28, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: active ? activeBg : 'transparent' }}
          >
            <Txt v="caption" color={active ? activeFg : fg} style={{ fontWeight: '700' }}>
              {l.short}
            </Txt>
          </Tap>
        );
      })}
    </Row>
  );
}
