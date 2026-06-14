export const colors = {
  // Core backgrounds
  background: '#F8FAFC',
  backgroundElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceGlass: '#FFFFFFB0',
  surfaceGlassStrong: '#FFFFFFE0',
  surfaceElevated: '#FFFFFF',
  surfacePressed: '#E2E8F0',

  // Liquid glass
  glassFrost: '#FFFFFF80',
  glassBorder: '#FFFFFFD0',
  glassHighlight: '#FFFFFFE8',
  glassShimmer: '#FFFFFFD5',
  glassOverlay: 'rgba(15, 23, 42, 0.3)',

  // Borders
  highlight: '#FFFFFF',
  border: '#E2E8F0',
  borderGlass: '#E2E8F0',
  borderStrong: '#CBD5E1',

  // Text
  text: '#0F172A',
  textMuted: '#475569',
  textSubtle: '#64748B',

  // Accent — premium vibrant blue
  accent: '#2563EB',
  accentSoft: '#EFF6FF',
  accentGlass: '#DBEAFE90',
  accentBorder: '#BFDBFE',

  // Semantic
  success: '#10B981',
  successSoft: '#D1FAE5',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  info: '#0EA5E9',
  infoSoft: '#E0F2FE',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  violet: '#8B5CF6',
  violetSoft: '#EDE9FE',
};

export const Colors = {
  light: {
    text: colors.text,
    background: colors.background,
    tint: colors.accent,
    icon: colors.textMuted,
    tabIconDefault: colors.textSubtle,
    tabIconSelected: colors.accent,
  },
  dark: {
    text: colors.text,
    background: colors.background,
    tint: colors.accent,
    icon: colors.textMuted,
    tabIconDefault: colors.textSubtle,
    tabIconSelected: colors.accent,
  },
};

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  card: 24,
  pill: 50,
};

export const spacing = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
};

export const typography = {
  eyebrow: 10,
  caption: 12,
  body: 13,
  bodyLarge: 14,
  title: 17,
  screenTitle: 20,
  statValue: 22,
};

export const shadows = {
  glass: {
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  accent: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  subtle: {
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  }),
};

export const animation = {
  press: {
    scale: 0.97,
    opacity: 0.85,
  },
  spring: {
    damping: 15,
    stiffness: 150,
  },
  timing: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
};

export const LIST_CONFIG = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 8,
  windowSize: 7,
  updateCellsBatchingPeriod: 32,
  removeClippedSubviews: true,
};

export const TEXT_LIST_CONFIG = {
  initialNumToRender: 12,
  maxToRenderPerBatch: 12,
  windowSize: 9,
  updateCellsBatchingPeriod: 24,
  removeClippedSubviews: true,
};

// Tone color map for reuse
export const toneMap = {
  accent: { fg: colors.accent, bg: colors.accentSoft },
  success: { fg: colors.success, bg: colors.successSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  violet: { fg: colors.violet, bg: colors.violetSoft },
} as const;
