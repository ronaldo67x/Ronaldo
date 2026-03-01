export type Mode = 'light' | 'dark';
export type PresetName = 'ocean' | 'sunset' | 'forest';

type Palette = {
  primary: string;
  accent: string;
  surface: string;
  background: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  focus: string;
};

type Scale = {
  fontFamily: string;
  fontSizeXs: string;
  fontSizeSm: string;
  fontSizeMd: string;
  fontSizeLg: string;
  fontSizeXl: string;
  lineHeight: string;
  spacingXs: string;
  spacingSm: string;
  spacingMd: string;
  spacingLg: string;
  spacingXl: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
};

type ThemePreset = Record<Mode, Palette>;

export const THEME_PRESETS: Record<PresetName, ThemePreset> = {
  ocean: {
    light: {
      primary: '#0b63f6',
      accent: '#14b8a6',
      surface: '#ffffff',
      background: '#f4f8ff',
      text: '#102142',
      textMuted: '#4c5b7b',
      border: '#d4e2ff',
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626',
      focus: '#1d4ed8',
    },
    dark: {
      primary: '#5ea1ff',
      accent: '#2dd4bf',
      surface: '#12203d',
      background: '#080f1f',
      text: '#edf4ff',
      textMuted: '#b8c9ea',
      border: '#304f89',
      success: '#4ade80',
      warning: '#fbbf24',
      danger: '#f87171',
      focus: '#93c5fd',
    },
  },
  sunset: {
    light: {
      primary: '#b83280',
      accent: '#ed8936',
      surface: '#fffdfb',
      background: '#fff6f0',
      text: '#3d1f2d',
      textMuted: '#6f4b5c',
      border: '#f3d2dd',
      success: '#2f855a',
      warning: '#b7791f',
      danger: '#c53030',
      focus: '#97266d',
    },
    dark: {
      primary: '#f687b3',
      accent: '#f6ad55',
      surface: '#2c1321',
      background: '#190b12',
      text: '#fff1f7',
      textMuted: '#f0c4d9',
      border: '#6b2f4d',
      success: '#68d391',
      warning: '#f6e05e',
      danger: '#fc8181',
      focus: '#fbb6ce',
    },
  },
  forest: {
    light: {
      primary: '#2f855a',
      accent: '#6b46c1',
      surface: '#fdfffd',
      background: '#f3faf5',
      text: '#123326',
      textMuted: '#406253',
      border: '#cce6d5',
      success: '#15803d',
      warning: '#b45309',
      danger: '#b91c1c',
      focus: '#276749',
    },
    dark: {
      primary: '#68d391',
      accent: '#b794f4',
      surface: '#14291f',
      background: '#0a1712',
      text: '#ecfff3',
      textMuted: '#bfdfce',
      border: '#355848',
      success: '#4ade80',
      warning: '#fcd34d',
      danger: '#fca5a5',
      focus: '#9ae6b4',
    },
  },
};

export const SCALE_TOKENS: Scale = {
  fontFamily: "'Inter', 'Segoe UI', Roboto, sans-serif",
  fontSizeXs: '0.75rem',
  fontSizeSm: '0.875rem',
  fontSizeMd: '1rem',
  fontSizeLg: '1.25rem',
  fontSizeXl: '1.75rem',
  lineHeight: '1.5',
  spacingXs: '0.25rem',
  spacingSm: '0.5rem',
  spacingMd: '0.75rem',
  spacingLg: '1rem',
  spacingXl: '1.5rem',
  radiusSm: '0.375rem',
  radiusMd: '0.625rem',
  radiusLg: '0.875rem',
  shadowSm: '0 1px 2px rgb(15 23 42 / 0.08)',
  shadowMd: '0 8px 20px rgb(15 23 42 / 0.12)',
  shadowLg: '0 16px 30px rgb(15 23 42 / 0.16)',
};

export const toCssVariables = (
  mode: Mode,
  preset: PresetName,
  overrides?: Partial<Pick<Palette, 'primary' | 'accent'>>,
): Record<string, string> => {
  const palette = { ...THEME_PRESETS[preset][mode], ...overrides };

  return {
    '--color-primary': palette.primary,
    '--color-accent': palette.accent,
    '--color-surface': palette.surface,
    '--color-background': palette.background,
    '--color-text': palette.text,
    '--color-text-muted': palette.textMuted,
    '--color-border': palette.border,
    '--color-success': palette.success,
    '--color-warning': palette.warning,
    '--color-danger': palette.danger,
    '--color-focus': palette.focus,
    '--font-family': SCALE_TOKENS.fontFamily,
    '--font-size-xs': SCALE_TOKENS.fontSizeXs,
    '--font-size-sm': SCALE_TOKENS.fontSizeSm,
    '--font-size-md': SCALE_TOKENS.fontSizeMd,
    '--font-size-lg': SCALE_TOKENS.fontSizeLg,
    '--font-size-xl': SCALE_TOKENS.fontSizeXl,
    '--line-height': SCALE_TOKENS.lineHeight,
    '--space-xs': SCALE_TOKENS.spacingXs,
    '--space-sm': SCALE_TOKENS.spacingSm,
    '--space-md': SCALE_TOKENS.spacingMd,
    '--space-lg': SCALE_TOKENS.spacingLg,
    '--space-xl': SCALE_TOKENS.spacingXl,
    '--radius-sm': SCALE_TOKENS.radiusSm,
    '--radius-md': SCALE_TOKENS.radiusMd,
    '--radius-lg': SCALE_TOKENS.radiusLg,
    '--shadow-sm': SCALE_TOKENS.shadowSm,
    '--shadow-md': SCALE_TOKENS.shadowMd,
    '--shadow-lg': SCALE_TOKENS.shadowLg,
  };
};

const hexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const expanded =
    clean.length === 3
      ? clean
          .split('')
          .map((x) => `${x}${x}`)
          .join('')
      : clean;
  const value = Number.parseInt(expanded, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const relativeLuminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

export const getContrastRatio = (fgHex: string, bgHex: string) => {
  const fg = relativeLuminance(hexToRgb(fgHex));
  const bg = relativeLuminance(hexToRgb(bgHex));
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
};

export const wcagResult = (ratio: number, largeText = false) => {
  const threshold = largeText ? 3 : 4.5;
  return {
    ratio,
    passes: ratio >= threshold,
    level: ratio >= 7 ? 'AAA' : ratio >= threshold ? 'AA' : 'Fail',
  };
};
