import { createContext, useContext, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { getCookTokens, type CookTokens } from '@/theme/cook-tokens';

type CookThemeContextValue = {
  dark: boolean;
  tokens: CookTokens;
};

const CookThemeContext = createContext<CookThemeContextValue>({
  dark: false,
  tokens: getCookTokens('light'),
});

export function useCookTheme(): CookThemeContextValue {
  return useContext(CookThemeContext);
}

type CookThemeScopeProps = {
  theme: 'dark' | 'light';
  children: ReactNode;
};

export function CookThemeScope({ theme, children }: CookThemeScopeProps) {
  const dark = theme === 'dark';
  return (
    <CookThemeContext.Provider value={{ dark, tokens: getCookTokens(theme) }}>
      {children}
    </CookThemeContext.Provider>
  );
}

type CookShellProps = {
  theme?: 'dark' | 'light';
  children: ReactNode;
};

export function CookShell({ theme = 'dark', children }: CookShellProps) {
  const dark = theme === 'dark';
  const tokens = getCookTokens(theme);

  return (
    <CookThemeScope theme={theme}>
      <View
        className={dark ? 'cook-dark flex-1' : 'flex-1'}
        style={{ backgroundColor: tokens.bg, flex: 1 }}
      >
        <StatusBar style={dark ? 'light' : 'dark'} />
        {children}
      </View>
    </CookThemeScope>
  );
}
