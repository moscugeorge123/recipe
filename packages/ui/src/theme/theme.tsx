import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import {
  colors,
  fonts,
  type CulinaryColors,
  type CulinaryFonts,
  type TonePalette,
} from './tokens';

export type CulinaryTheme = {
  colors: CulinaryColors;
  fonts: CulinaryFonts;
};

export type ThemeOverride = {
  colors?: Partial<CulinaryColors>;
  fonts?: Partial<CulinaryFonts>;
};

const defaultTheme: CulinaryTheme = { colors, fonts };

const ThemeContext = createContext<CulinaryTheme>(defaultTheme);
const ToneContext = createContext<TonePalette | null>(null);

export function mergeTheme(override?: ThemeOverride): CulinaryTheme {
  if (!override) return defaultTheme;
  return {
    colors: { ...defaultTheme.colors, ...override.colors },
    fonts: { ...defaultTheme.fonts, ...override.fonts },
  };
}

export function ThemeProvider({
  value,
  children,
}: {
  value?: ThemeOverride;
  children: ReactNode;
}) {
  const theme = useMemo(() => mergeTheme(value), [value]);
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): CulinaryTheme {
  return useContext(ThemeContext);
}

export function ToneProvider({
  value,
  children,
}: {
  value: TonePalette;
  children: ReactNode;
}) {
  return <ToneContext.Provider value={value}>{children}</ToneContext.Provider>;
}

export function useTone(): TonePalette | null {
  return useContext(ToneContext);
}
