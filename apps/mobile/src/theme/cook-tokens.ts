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
  bg: colors.canvasDark,
  text: colors.onDark,
  muted: colors.onDarkMute,
  kicker: colors.onDark,
  dot: colors.onDark,
  rowText: colors.onDarkMute,
  divider: colors.hairlineDark,
  chipBg: colors.surfaceElevated,
  statBg: colors.surfaceElevated,
  ghostBg: colors.surfaceElevated,
  ghostText: colors.onDark,
  noteText: colors.onDarkMute,
  parallelBg: colors.surfaceElevated,
  parallelBorder: colors.hairlineDark,
  timerOnBg: colors.surfaceElevated,
  timerOnBorder: colors.onDark,
  timerOffBg: colors.surfaceElevated,
  timerOffBorder: colors.hairlineDark,
  timerOnText: colors.onDark,
  progressTrack: colors.hairlineDark,
};

export const cookTokensLight: CookTokens = {
  bg: colors.canvasLight,
  text: colors.ink,
  muted: colors.mute,
  kicker: colors.ink,
  dot: colors.ink,
  rowText: colors.body,
  divider: colors.hairlineLight,
  chipBg: colors.surfaceSoft,
  statBg: colors.surfaceSoft,
  ghostBg: colors.surfaceSoft,
  ghostText: colors.ink,
  noteText: colors.stone,
  parallelBg: colors.surfaceSoft,
  parallelBorder: colors.hairlineLight,
  timerOnBg: colors.surfaceSoft,
  timerOnBorder: colors.hairlineStrong,
  timerOffBg: colors.surfaceSoft,
  timerOffBorder: colors.hairlineLight,
  timerOnText: colors.ink,
  progressTrack: colors.hairlineLight,
};

export function getCookTokens(theme: 'dark' | 'light'): CookTokens {
  return theme === 'dark' ? cookTokensDark : cookTokensLight;
}
