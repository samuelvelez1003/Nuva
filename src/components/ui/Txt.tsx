import React from 'react';
import { StyleProp, Text, TextProps, TextStyle } from 'react-native';
import { moneyCurrency } from '../../lib/format';
import { colors, fonts, type, TypeVariant } from '../../theme/tokens';

export interface TxtProps extends TextProps {
  v?: TypeVariant;
  color?: string;
  weight?: keyof typeof fonts;
  align?: TextStyle['textAlign'];
  /** Tabular numerals keep money columns from jittering. */
  tabular?: boolean;
  style?: StyleProp<TextStyle>;
}

export function Txt({ v = 'body', color = colors.ink, weight, align, tabular, style, ...rest }: TxtProps) {
  return (
    <Text
      {...rest}
      style={[
        type[v],
        { color },
        weight && { fontFamily: fonts[weight] },
        align && { textAlign: align },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    />
  );
}

/**
 * Money with a smaller, raised peso sign — the signature numeric style used
 * across passenger, driver and admin.
 */
export function Money({
  value,
  size = 32,
  color = colors.ink,
  signColor,
  weight = 'extrabold',
  style,
}: {
  value: string;
  size?: number;
  color?: string;
  signColor?: string;
  weight?: keyof typeof fonts;
  style?: StyleProp<TextStyle>;
}) {
  // `value` comes from cop(): "$12.500", "−$500", "Cg24,19" — the sign follows the active currency.
  const { symbol, code } = moneyCurrency();
  const negative = value.startsWith('−');
  const body = negative ? value.slice(1) : value;
  const digits = body.startsWith(symbol) ? body.slice(symbol.length) : body.replace(/^\$/, '');
  return (
    <Text
      accessibilityLabel={`${negative ? '− ' : ''}${digits} ${code}`}
      style={[
        {
          fontFamily: fonts[weight],
          fontSize: size,
          lineHeight: Math.round(size * 1.08),
          letterSpacing: -size * 0.04,
          color,
          fontVariant: ['tabular-nums'],
        },
        style,
      ]}
    >
      {negative ? '−' : ''}
      <Text style={{ fontSize: Math.round(size * 0.58), color: signColor ?? color, letterSpacing: 0 }}>{symbol}</Text>
      {digits}
    </Text>
  );
}
