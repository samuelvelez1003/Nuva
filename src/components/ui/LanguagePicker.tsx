import React from 'react';
import { View } from 'react-native';
import { Globe } from 'lucide-react-native';
import { LANGS, useLanguage } from '../../i18n';
import { colors, fonts, radius } from '../../theme/tokens';
import { Tap } from './Button';
import { Row } from './primitives';
import { Txt } from './Txt';

/** ES · EN switch. `tone="dark"` for ink backgrounds, `"lime"` for teal ones. */
export function LanguagePicker({ tone = 'dark', compact }: { tone?: 'dark' | 'light' | 'lime'; compact?: boolean }) {
  const { lang, setLang } = useLanguage();
  const fg = tone === 'dark' ? colors.onDarkMuted : tone === 'lime' ? colors.onLime : colors.inkMuted;
  const activeBg = tone === 'lime' ? colors.white : tone === 'dark' ? colors.lime : colors.midnight;
  const activeFg = tone === 'lime' ? colors.limeInk : tone === 'dark' ? colors.onLime : colors.ivory;
  return (
    <Row
      style={{
        gap: 2,
        padding: 3,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: tone === 'dark' ? colors.lineDarkStrong : tone === 'lime' ? 'rgba(255,255,255,0.45)' : colors.lineLightStrong,
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
            hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
            onPress={() => setLang(l.code)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={l.label}
            style={{ height: 28, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: active ? activeBg : 'transparent' }}
          >
            <Txt v="caption" color={active ? activeFg : fg} style={{ fontFamily: fonts.bold }}>
              {l.short}
            </Txt>
          </Tap>
        );
      })}
    </Row>
  );
}
