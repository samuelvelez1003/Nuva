import { Platform, TextStyle } from 'react-native';

/**
 * NÜVA design tokens — the single source of truth shared by
 * Passenger, Driver and Admin.
 *
 * Style "28 · Aurora": a cool, airy ground (#F6F9F9) with soft aurora blobs
 * (mint / violet / cyan, blurred) behind clean white cards, deep ink text,
 * a teal accent and a violet secondary accent. Typeface: Sora.
 * The token names come from the first palette (midnight / lime / ivory) and are
 * kept so every screen follows the new look:
 *   midnight* → ink family (dark surfaces, headings, the route on light maps)
 *   lime*     → teal family (primary CTA, active states, highlights)
 *   coral     → violet (secondary accent: destination, graphic dots)
 *   ivory*    → cool neutral family (light surfaces)
 * Text on teal is always white (`onLime`, 5.0:1); teal text on light surfaces uses
 * `limeInk` for small sizes, on ink surfaces `limeOnDark` (mint).
 */

export const palette = {
  midnight: '#0E1B24',
  lime: '#0E7C74',
  ivory: '#F6F9F9',
  stone: '#8A979F',
  white: '#FFFFFF',
} as const;

/** The aurora blobs (graphics only, never under text without a white card). */
export const aurora = {
  mint: '#7BE0C4',
  violet: '#A99BF5',
  cyan: '#5ED1E0',
} as const;

export const colors = {
  ...palette,

  // Ink family (dark surfaces)
  midnight900: '#08121A',
  midnight800: '#0E1B24',
  midnight700: '#16252F',
  midnight600: '#1E2F3A',
  midnight500: '#2A3D49',
  midnight400: '#3C5160',

  // Cool neutral family (light surfaces)
  ivory50: '#FBFDFD',
  ivory100: '#F6F9F9',
  ivory200: '#EDF2F3',
  ivory300: '#E3EAEC',
  ivory400: '#DCE3E6',

  // Text
  ink: '#0E1B24',
  inkSoft: '#3C4B55',
  inkMuted: '#4E5D66', // AA on the ground, on ivory200 and on white
  onDark: '#F6F9F9',
  onDarkMuted: '#AFBCC4',
  onDarkFaint: '#8D9CA6', // still ≥4.5:1 on midnight700 / midnight600 (captions)

  // Teal family. `lime` is the CTA teal: white text on it passes AA (5.0:1).
  lime: '#0E7C74',
  /** Secondary accent (violet): destination square, graphic dots. White text on it passes AA (6.2:1). */
  coral: '#5B4BD6',
  /** Text and icons on `lime` (teal) fills. */
  onLime: '#FFFFFF',
  limeSoft: '#DDF5F1',
  limeTint: '#EEFAF7',
  limeInk: '#0B5F59', // teal-coloured text that stays readable on light surfaces (7.5:1 on white)
  limeOnDark: '#7BE0C4', // mint: teal-family text/icons that stay readable on ink surfaces
  limeDim: 'rgba(14,124,116,0.14)',

  // Violet family (secondary accent)
  violet: '#5B4BD6',
  violetSoft: '#EEEAFD',
  violetOnDark: '#B9AFFA',

  // Mint (success chips)
  mint: '#DDF5F1',
  mintInk: '#0B5F59',
  sage: '#C6EBE3',

  // Semantic
  danger: '#D9363E',
  dangerOnDark: '#FF8F8F',
  dangerSoft: '#FDE4E4',
  dangerInk: '#A61B1B',
  warning: '#E9A23B',
  warningSoft: '#FFF1DA',
  warningInk: '#8A5300',
  info: '#5ED1E0',
  infoSoft: '#E3F6FA',
  infoInk: '#0A5A6A',

  // Lines
  lineLight: 'rgba(14,27,36,0.08)',
  lineLightStrong: 'rgba(14,27,36,0.16)',
  lineDark: 'rgba(246,249,249,0.10)',
  lineDarkStrong: 'rgba(246,249,249,0.20)',

  scrim: 'rgba(8,18,26,0.55)',
} as const;

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
} as const;

/** Aurora radii: cards 22–26, inner panels 14, icon chips 10–12, buttons and nav are pills. */
export const radius = {
  xs: 10,
  sm: 14,
  md: 18,
  lg: 22,
  xl: 26,
  xxl: 34,
  pill: 999,
} as const;

/** Sora. The mockup tops out at 700, so `extrabold` maps to Bold (one file less to load). */
export const fonts = {
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semibold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  extrabold: 'Sora_700Bold',
} as const;

type TypeStyle = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'textTransform'>;

/** Type scale. Sora runs wide: display sizes are tight (≈ −0.035em), small sizes open up. */
export const type = {
  hero: { fontFamily: fonts.bold, fontSize: 52, lineHeight: 56, letterSpacing: -1.8 },
  display: { fontFamily: fonts.bold, fontSize: 38, lineHeight: 42, letterSpacing: -1.2 },
  h1: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.8 },
  h2: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  h3: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, letterSpacing: 0 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, letterSpacing: 0 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof type;

/** Soft ink shadows, like the mockup's white cards (0 10–18px 26–40px, 7–8 % ink). */
export const shadow = {
  float: Platform.select({
    web: { boxShadow: '0 18px 40px -12px rgba(14,27,36,0.20), 0 2px 6px rgba(14,27,36,0.05)' } as object,
    default: {
      shadowColor: '#0E1B24',
      shadowOpacity: 0.14,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 10,
    },
  }),
  soft: Platform.select({
    web: { boxShadow: '0 10px 26px rgba(14,27,36,0.07)' } as object,
    default: {
      shadowColor: '#0E1B24',
      shadowOpacity: 0.07,
      shadowRadius: 13,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
  }),
  glow: Platform.select({
    web: { boxShadow: '0 12px 26px rgba(14,124,116,0.25)' } as object,
    default: {
      shadowColor: '#0E7C74',
      shadowOpacity: 0.25,
      shadowRadius: 13,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  }),
} as const;

export const motion = {
  fast: 160,
  base: 260,
  slow: 420,
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
} as const;

/** Glass is reserved for elements floating over the map (and the web nav pill). */
export const glass = {
  light: Platform.select({
    web: {
      backgroundColor: 'rgba(255,255,255,0.82)',
      backdropFilter: 'blur(18px) saturate(140%)',
    } as object,
    default: { backgroundColor: 'rgba(255,255,255,0.97)' },
  }),
  dark: Platform.select({
    web: {
      backgroundColor: 'rgba(14,27,36,0.82)',
      backdropFilter: 'blur(18px) saturate(140%)',
    } as object,
    default: { backgroundColor: 'rgba(14,27,36,0.96)' },
  }),
};
