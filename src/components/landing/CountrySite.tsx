import React, { useEffect } from 'react';
import { View } from 'react-native';
import type { CountryCode } from '../../lib/countries';
import { useCountry } from '../../lib/country';
import { colors } from '../../theme/tokens';
import Landing from './Landing';

/** A country's public site (/colombia, /curazao): makes sure that country is active. */
export function CountrySite({ code }: { code: CountryCode }) {
  const { code: active, setCountry } = useCountry();
  useEffect(() => {
    if (active !== code) setCountry(code);
  }, [active, code, setCountry]);
  if (active !== code) return <View style={{ flex: 1, backgroundColor: colors.midnight }} />;
  return <Landing />;
}
