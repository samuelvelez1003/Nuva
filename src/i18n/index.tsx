import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { authStorage } from '../lib/storage';
import { setFormatLanguage } from '../lib/format';
import { en } from './en';
import { es } from './es';
import { pap } from './pap';

// ─── Types ──────────────────────────────────────────────────────────────────

export type Lang = 'es' | 'en' | 'pap';
/** Every key of the Spanish source dictionary. A typo is a compile error. */
export type TKey = keyof typeof es;
export type TVars = Record<string, string | number>;
export type TFunction = (key: TKey, vars?: TVars) => string;

export const LANGS: readonly { code: Lang; label: string; short: string }[] = [
  { code: 'es', label: 'Español', short: 'ES' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'pap', label: 'Papiamentu', short: 'PAP' },
];

export const DEFAULT_LANG: Lang = 'es';
const STORAGE_KEY = 'nuva.lang';

const DICTS: Record<Lang, Record<TKey, string>> = { es, en, pap };

export const isLang = (v: unknown): v is Lang => v === 'es' || v === 'en' || v === 'pap';

// ─── Persistence (authStorage may be undefined during static web rendering) ─

function readStoredLang(): Lang {
  try {
    const v = authStorage?.getItem(STORAGE_KEY);
    return isLang(v) ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

function writeStoredLang(lang: Lang) {
  try {
    authStorage?.setItem(STORAGE_KEY, lang);
  } catch {
    // Storage full / blocked (private mode): the choice just won't persist.
  }
}

// ─── Pure translation (usable outside components) ──────────────────────────

/** Replaces `{name}` placeholders; unknown placeholders are left untouched. */
function interpolate(text: string, vars?: TVars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/**
 * Looks `key` up in `lang`, falling back to Spanish (and to the key itself as
 * a last resort, so a broken key is visible instead of an empty label).
 */
export function translate(lang: Lang, key: TKey, vars?: TVars): string {
  const text = DICTS[lang]?.[key] || es[key] || key;
  return interpolate(text, vars);
}

// ─── React context ──────────────────────────────────────────────────────────

type LanguageContextValue = { lang: Lang; setLang: (lang: Lang) => void };

// Works without a provider too (Spanish, no-op setter), e.g. in isolated tests.
const LanguageContext = createContext<LanguageContextValue>({ lang: DEFAULT_LANG, setLang: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Native: storage is synchronous (expo-sqlite localStorage), read it right away.
  // Web: start in Spanish so the static HTML and the first client render match,
  // then switch after hydration.
  const [lang, setLangState] = useState<Lang>(() => (Platform.OS === 'web' ? DEFAULT_LANG : readStoredLang()));

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const stored = readStoredLang();
    if (stored !== DEFAULT_LANG) setLangState(stored);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    writeStoredLang(next);
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  // Dates and times ("Hoy"/"Today", months, a. m.) follow the language, set before children render.
  setFormatLanguage(lang);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Current language and setter: `const { lang, setLang } = useLanguage();` */
export function useLanguage() {
  return useContext(LanguageContext);
}

/** `const t = useT(); t('pax.home.youAreIn', { area })` */
export function useT(): TFunction {
  const { lang } = useContext(LanguageContext);
  return useCallback<TFunction>((key, vars) => translate(lang, key, vars), [lang]);
}
