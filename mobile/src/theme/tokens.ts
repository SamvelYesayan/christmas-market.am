// Christmas Market design system — tokens.
// Night-market palette taken from the website (midnight, ember, emerald, gold, frost, paper) and tuned for
// small screens: solid layered surfaces instead of glass, one warm accent (gold), ember reserved for the
// primary purchase/danger moments, and a cream "paper" surface for letters, tickets and calendar gifts.

export const palette = {
  deep: '#060B1D',
  midnight: '#0B1430',
  ink: '#0E1838',
  surface: '#111C40',
  raised: '#18244F',
  raisedHi: '#1F2D5E',
  line: 'rgba(169,199,255,0.16)',
  lineStrong: 'rgba(169,199,255,0.32)',

  text: '#EEF2FF',
  muted: '#AAB6D8',
  faint: 'rgba(238,242,255,0.55)',

  gold: '#F2C46D',
  goldHi: '#FFE2A8',
  goldLo: '#A87A1C',
  goldInk: '#2A1C05',

  ember: '#C8102E',
  emberHi: '#E8384F',
  emerald: '#0F6B4F',
  emeraldHi: '#1F9A72',
  frost: '#A9C7FF',
  snow: '#F6F8FF',

  paper: '#F5ECD7',
  paperEdge: '#E6D7B5',
  paperInk: '#3A2A1A',
  paperMuted: '#7A6247',

  success: '#5FD3A2',
  warning: '#F2C46D',
  danger: '#FF7A88',
  overlay: 'rgba(4,8,22,0.72)',
} as const;

export const colors = {
  bg: palette.midnight,
  bgDeep: palette.deep,
  surface: palette.surface,
  raised: palette.raised,
  raisedHi: palette.raisedHi,
  border: palette.line,
  borderStrong: palette.lineStrong,
  text: palette.text,
  textMuted: palette.muted,
  textFaint: palette.faint,
  accent: palette.gold,
  accentHi: palette.goldHi,
  accentLo: palette.goldLo,
  onAccent: palette.goldInk,
  primary: palette.ember,
  primaryHi: palette.emberHi,
  onPrimary: palette.snow,
  green: palette.emeraldHi,
  frost: palette.frost,
  paper: palette.paper,
  paperEdge: palette.paperEdge,
  paperInk: palette.paperInk,
  paperMuted: palette.paperMuted,
  success: palette.success,
  danger: palette.danger,
  overlay: palette.overlay,
} as const;

/** 4-pt spacing scale. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40, huge: 56 } as const;

export const radius = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;

/** Elevation: soft, low, warm-tinted. */
export const shadow = {
  none: {},
  card: { shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  lifted: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 10 },
  glow: { shadowColor: palette.gold, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
} as const;

export const motion = {
  fast: 160,
  base: 260,
  slow: 480,
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
} as const;

/** Font families per language: Latin faces have no Armenian glyphs, so Armenian uses Noto (serif/sans). */
export const fontFamilies = {
  en: {
    display: 'Fraunces_600SemiBold',
    displayItalic: 'Fraunces_500Medium_Italic',
    body: 'InstrumentSans_400Regular',
    bodyMedium: 'InstrumentSans_500Medium',
    bodyBold: 'InstrumentSans_700Bold',
  },
  hy: {
    display: 'NotoSerifArmenian_600SemiBold',
    displayItalic: 'NotoSerifArmenian_500Medium',
    body: 'NotoSansArmenian_400Regular',
    bodyMedium: 'NotoSansArmenian_500Medium',
    bodyBold: 'NotoSansArmenian_700Bold',
  },
} as const;

export type FontRole = keyof typeof fontFamilies.en;

/** Type ramp (size / line height). */
export const type = {
  hero: { fontSize: 34, lineHeight: 40, role: 'display' as FontRole },
  title: { fontSize: 26, lineHeight: 32, role: 'display' as FontRole },
  heading: { fontSize: 20, lineHeight: 26, role: 'display' as FontRole },
  subheading: { fontSize: 17, lineHeight: 23, role: 'bodyBold' as FontRole },
  body: { fontSize: 15, lineHeight: 22, role: 'body' as FontRole },
  bodyStrong: { fontSize: 15, lineHeight: 22, role: 'bodyBold' as FontRole },
  label: { fontSize: 13, lineHeight: 18, role: 'bodyMedium' as FontRole },
  caption: { fontSize: 12, lineHeight: 16, role: 'body' as FontRole },
  eyebrow: { fontSize: 11, lineHeight: 14, role: 'bodyBold' as FontRole },
  number: { fontSize: 40, lineHeight: 46, role: 'display' as FontRole },
} as const;

export type TypeVariant = keyof typeof type;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;
export const minTouch = 44;
