import React, { createContext, useContext, useMemo } from 'react';
import { COUNTRIES, Country, CountryCode } from './countries';
import { applyRegion } from './region';

/**
 * Active country. NÜVA only operates in Colombia, so it is always 'CO'; the
 * context stays so screens read the country config (currency, places, phone
 * format, payments) from one place.
 */

interface CountryState {
  country: Country;
  code: CountryCode;
}

const Ctx = createContext<CountryState | null>(null);

const CODE: CountryCode = 'CO';

export function CountryProvider({ children }: { children: React.ReactNode }) {
  // Point the shared modules at the country before anything below renders.
  useMemo(() => applyRegion(CODE), []);
  const value = useMemo(() => ({ country: COUNTRIES[CODE], code: CODE }), []);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCountry() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCountry must be used inside CountryProvider');
  return v;
}
