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
  tokens: getCookTokens(),
});

export function useCookTheme(): CookThemeContextValue {
  return useContext(CookThemeContext);
}

type CookShellProps = {
  theme?: 'dark' | 'light';
  children: ReactNode;
};

export function CookShell({ theme = 'light', children }: CookShellProps) {
  const tokens = getCookTokens(theme === 'dark' ? 'light' : theme);

  return (
    <CookThemeContext.Provider value={{ dark: false, tokens }}>
      <View className="flex-1" style={{ backgroundColor: tokens.bg, flex: 1 }}>
        <StatusBar style="dark" />
        {children}
      </View>
    </CookThemeContext.Provider>
  );
}
