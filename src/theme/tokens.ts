import { Platform, TextStyle } from 'react-native';

/**
 * NÜVA design tokens — the single source of truth shared by
 * Passenger, Driver and Admin.
 */

export const palette = {
  midnight: '#101411',
  lime: '#D4FF5F',
  ivory: '#F5F6F0',
  stone: '#8B8F89',
  white: '#FFFFFF',
} as const;

export const colors = {
  ...palette,

  // Midnight family (dark surfaces)
  midnight900: '#0A0D0B',
  midnight800: '#101411',
  midnight700: '#171C18',
  midnight600: '#1F2520',
  midnight500: '#2A312B',
  midnight400: '#3A423B',

  // Ivory family (light surfaces)
  ivory50: '#FBFBF8',
  ivory100: '#F5F6F0',
  ivory200: '#ECEDE5',
  ivory300: '#E1E3D9',
  ivory400: '#CDD0C5',

  // Text
  ink: '#101411',
  inkSoft: '#3C413D',
  inkMuted: '#656A64', // AA on ivory/white for body text
  onDark: '#F5F6F0',
  onDarkMuted: '#9DA29B',
  onDarkFaint: '#5F655F',

  // Lime family
  lime: '#D4FF5F',
  limeSoft: '#E9FFB0',
  limeTint: '#F3FFD6',
  limeInk: '#3D5A00', // lime-coloured text that stays readable on light
  limeDim: 'rgba(212,255,95,0.14)',

  // Semantic
  danger: '#FF5B4A',
  dangerSoft: '#FFE7E3',
  dangerInk: '#B3261E',
  warning: '#FFB547',
  warningSoft: '#FFF1DA',
  warningInk: '#8A5300',
  info: '#7DB6FF',
  infoSoft: '#E5F0FF',

  // Lines
  lineLight: 'rgba(16,20,17,0.08)',
  lineLightStrong: 'rgba(16,20,17,0.14)',
  lineDark: 'rgba(245,246,240,0.08)',
  lineDarkStrong: 'rgba(245,246,240,0.16)',

  scrim: 'rgba(10,13,11,0.55)',
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

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 36,
  pill: 999,
} as const;

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

type TypeStyle = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'textTransform'>;

/** Editorial type scale. Display sizes run tight, small sizes open up. */
export const type = {
  hero: { fontFamily: fonts.extrabold, fontSize: 56, lineHeight: 56, letterSpacing: -2.4 },
  display: { fontFamily: fonts.extrabold, fontSize: 40, lineHeight: 42, letterSpacing: -1.6 },
  h1: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 34, letterSpacing: -1.1 },
  h2: { fontFamily: fonts.bold, fontSize: 23, lineHeight: 28, letterSpacing: -0.6 },
  h3: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 23, letterSpacing: -0.3 },
  title: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, letterSpacing: -0.2 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, letterSpacing: -0.1 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, letterSpacing: -0.1 },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  smallStrong: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  caption: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  overline: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof type;

export const shadow = {
  float: Platform.select({
    web: { boxShadow: '0 18px 40px -16px rgba(16,20,17,0.35), 0 2px 6px rgba(16,20,17,0.06)' } as object,
    default: {
      shadowColor: '#101411',
      shadowOpacity: 0.18,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 10,
    },
  }),
  soft: Platform.select({
    web: { boxShadow: '0 6px 18px -8px rgba(16,20,17,0.22)' } as object,
    default: {
      shadowColor: '#101411',
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
  }),
  glow: Platform.select({
    web: { boxShadow: '0 10px 30px -8px rgba(212,255,95,0.55)' } as object,
    default: {
      shadowColor: '#D4FF5F',
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  }),
} as const;

export const motion = {
  fast: 160,
  base: 260,
  slow: 420,
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
} as const;

/** Glass is reserved for elements floating over the map. */
export const glass = {
  light: Platform.select({
    web: {
      backgroundColor: 'rgba(251,251,248,0.78)',
      backdropFilter: 'blur(18px) saturate(140%)',
    } as object,
    default: { backgroundColor: 'rgba(251,251,248,0.96)' },
  }),
  dark: Platform.select({
    web: {
      backgroundColor: 'rgba(16,20,17,0.72)',
      backdropFilter: 'blur(18px) saturate(140%)',
    } as object,
    default: { backgroundColor: 'rgba(16,20,17,0.94)' },
  }),
};
