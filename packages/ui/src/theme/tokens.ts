import type { ViewStyle } from 'react-native';

/** Locked card radius from the Savory screens. Not configurable. */
export const cardRadius = 16;

export const colors = {
  canvas: '#f8faf5',
  lowest: '#ffffff',
  low: '#f3f4ef',
  container: '#edeee9',
  high: '#e7e9e4',
  ink: '#191c19',
  muted: '#424842',
  meadow: '#789a7e',
  outline: '#727972',
  outlineVariant: '#c2c8c0',
  primary: '#32533c',
  primaryContainer: '#4a6b53',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#c5eacc',
  primaryFixed: '#c7ecce',
  accent: '#a23e18',
  accentContainer: '#fe8357',
  accentFixed: '#ffdbcf',
  onAccent: '#ffffff',
  onAccentFixed: '#390c00',
  inverse: '#2e312e',
  onInverse: '#f0f1ec',
} as const;

export type CulinaryColors = typeof colors;

/**
 * Names registered by `@expo-google-fonts/newsreader`,
 * `@expo-google-fonts/plus-jakarta-sans`, and `@expo-google-fonts/ibm-plex-mono`.
 * Load those families in the app, or override them through `ThemeProvider`.
 */
export const fonts = {
  display: 'Newsreader_500Medium',
  headline: 'Newsreader_600SemiBold',
  body: 'PlusJakartaSans_400Regular',
  title: 'PlusJakartaSans_700Bold',
  label: 'PlusJakartaSans_600SemiBold',
  mono: 'IBMPlexMono_500Medium',
} as const;

export type CulinaryFonts = typeof fonts;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  margin: 20,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#32533c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  md: {
    shadowColor: '#4a6b53',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
} as const satisfies Record<'sm' | 'md', ViewStyle>;

export type SurfaceTone =
  | 'canvas'
  | 'lowest'
  | 'low'
  | 'container'
  | 'high'
  | 'primary'
  | 'accent'
  | 'inverse';

export type TonePalette = {
  backgroundColor: string;
  color: string;
  muted: string;
};

export function tonePalette(
  palette: CulinaryColors,
  tone: SurfaceTone,
): TonePalette {
  switch (tone) {
    case 'canvas':
      return {
        backgroundColor: palette.canvas,
        color: palette.ink,
        muted: palette.muted,
      };
    case 'lowest':
      return {
        backgroundColor: palette.lowest,
        color: palette.ink,
        muted: palette.muted,
      };
    case 'low':
      return {
        backgroundColor: palette.low,
        color: palette.ink,
        muted: palette.muted,
      };
    case 'container':
      return {
        backgroundColor: palette.container,
        color: palette.ink,
        muted: palette.muted,
      };
    case 'high':
      return {
        backgroundColor: palette.high,
        color: palette.ink,
        muted: palette.muted,
      };
    case 'primary':
      return {
        backgroundColor: palette.primary,
        color: palette.onPrimary,
        muted: palette.onPrimaryContainer,
      };
    case 'accent':
      return {
        backgroundColor: palette.accentFixed,
        color: palette.accent,
        muted: palette.onAccentFixed,
      };
    case 'inverse':
      return {
        backgroundColor: palette.inverse,
        color: palette.onInverse,
        muted: palette.outlineVariant,
      };
  }
}
