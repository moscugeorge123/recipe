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
  bg: colors.espresso,
  text: colors.onPrimary,
  muted: colors.sage,
  kicker: colors.onPrimary,
  dot: colors.paprika,
  rowText: colors.onPrimary,
  divider: colors.crust,
  chipBg: 'transparent',
  statBg: 'transparent',
  ghostBg: 'transparent',
  ghostText: colors.onPrimary,
  noteText: colors.sage,
  parallelBg: 'transparent',
  parallelBorder: colors.crust,
  timerOnBg: 'transparent',
  timerOnBorder: colors.paprika,
  timerOffBg: 'transparent',
  timerOffBorder: colors.crust,
  timerOnText: colors.paprika,
  progressTrack: colors.crust,
};

export const cookTokensLight: CookTokens = {
  bg: colors.cream,
  text: colors.espresso,
  muted: colors.olive,
  kicker: colors.olive,
  dot: colors.paprika,
  rowText: colors.cocoa,
  divider: colors.crust,
  chipBg: colors.peach,
  statBg: colors.linen,
  ghostBg: colors.peach,
  ghostText: colors.espresso,
  noteText: colors.sage,
  parallelBg: colors.peach,
  parallelBorder: colors.crust,
  timerOnBg: colors.peach,
  timerOnBorder: colors.paprika,
  timerOffBg: colors.peach,
  timerOffBorder: colors.crust,
  timerOnText: colors.paprika,
  progressTrack: colors.crust,
};

export function getCookTokens(theme: 'dark' | 'light'): CookTokens {
  return theme === 'dark' ? cookTokensDark : cookTokensLight;
}
