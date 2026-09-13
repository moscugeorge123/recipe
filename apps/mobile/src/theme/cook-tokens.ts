import { colors } from '@/theme/tokens';

export type CookTokens = {
  bg: string;
  text: string;
  muted: string;
  kicker: string;
  dot: string;
  rowText: string;
  divider: string;
  chipBg: string;
  statBg: string;
  ghostBg: string;
  ghostText: string;
  noteText: string;
  parallelBg: string;
  parallelBorder: string;
  timerOnBg: string;
  timerOnBorder: string;
  timerOffBg: string;
  timerOffBorder: string;
  timerOnText: string;
  progressTrack: string;
};

export const cookTokensDark: CookTokens = {
  bg: '#1A1612',
  text: '#F5EDE4',
  muted: '#B5A898',
  kicker: '#F6D56A',
  dot: colors.paprika,
  rowText: '#E3D9CC',
  divider: 'rgba(255,255,255,0.14)',
  chipBg: 'rgba(255,255,255,0.07)',
  statBg: 'rgba(255,255,255,0.06)',
  ghostBg: 'rgba(255,255,255,0.08)',
  ghostText: '#F5EDE4',
  noteText: '#7C736C',
  parallelBg: 'rgba(246,213,106,0.09)',
  parallelBorder: 'rgba(246,213,106,0.4)',
  timerOnBg: 'rgba(246,213,106,0.16)',
  timerOnBorder: 'rgba(246,213,106,0.5)',
  timerOffBg: 'rgba(255,255,255,0.08)',
  timerOffBorder: 'rgba(255,255,255,0.14)',
  timerOnText: '#F6D56A',
  progressTrack: 'rgba(255,255,255,0.14)',
};

export const cookTokensLight: CookTokens = {
  bg: colors.page,
  text: colors.espresso,
  muted: colors.tabInactive,
  kicker: colors.paprikaPressed,
  dot: colors.paprika,
  rowText: colors.espresso,
  divider: colors.paper,
  chipBg: colors.paper,
  statBg: colors.paper,
  ghostBg: colors.paper,
  ghostText: colors.espresso,
  noteText: colors.tabInactive,
  parallelBg: colors.paprikaSoft,
  parallelBorder: colors.paprika400,
  timerOnBg: colors.paprikaSoft,
  timerOnBorder: colors.paprika400,
  timerOffBg: colors.paper,
  timerOffBorder: colors.ctaDisabled,
  timerOnText: colors.paprikaPressed,
  progressTrack: colors.ctaDisabled,
};

export function getCookTokens(theme: 'dark' | 'light' = 'light'): CookTokens {
  return theme === 'dark' ? cookTokensDark : cookTokensLight;
}
