import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from '../store/Auth';
import { COUNTRIES, Country, CountryCode, isCountryCode } from './countries';
import { applyRegion } from './region';
import { authStorage } from './storage';

/**
 * Active country. A signed-in account always uses its own country; otherwise
 * the device remembers the last choice (Colombia by default). Changing country
 * remounts the app below so every screen, map and price starts fresh.
 */

const KEY = 'nuva.country';

function readStored(): CountryCode {
  try {
    const v = authStorage?.getItem?.(KEY);
    return isCountryCode(v) ? v : 'CO';
  } catch {
    return 'CO';
  }
}

interface CountryState {
  country: Country;
  code: CountryCode;
  /** Device choice (ignored while signed in: the account's country wins). */
  setCountry: (c: CountryCode) => void;
  /** True when the country comes from the account and can't be changed here. */
  locked: boolean;
}

const Ctx = createContext<CountryState | null>(null);

export function CountryProvider({ children, override }: { children: React.ReactNode; override?: CountryCode }) {
  const { session, profile } = useAuth();
  const [chosen, setChosen] = useState<CountryCode>(readStored);
  // Admins switch freely between countries; passengers and drivers live in their account's country.
  const accountCountry = session && profile && profile.role !== 'admin' && isCountryCode(profile.country) ? profile.country : null;
  const code = override ?? accountCountry ?? chosen;

  // Point the shared modules at this country before anything below renders.
  useMemo(() => applyRegion(code), [code]);

  const setCountry = useCallback((c: CountryCode) => {
    setChosen(c);
    try {
      authStorage?.setItem?.(KEY, c);
    } catch {
      /* private mode: keep in memory */
    }
  }, []);

  const value = useMemo(() => ({ country: COUNTRIES[code], code, setCountry, locked: !!accountCountry && !override }), [code, setCountry, accountCountry, override]);
  // key={code}: a new country remounts the tree so cached projections/places are rebuilt.
  return (
    <Ctx.Provider value={value}>
      <React.Fragment key={code}>{children}</React.Fragment>
    </Ctx.Provider>
  );
}

export function useCountry() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCountry must be used inside CountryProvider');
  return v;
}
