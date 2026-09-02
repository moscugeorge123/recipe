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
  bg: colors.tile1,
  text: colors.onDark,
  muted: colors.bodyMuted,
  kicker: colors.bodyMuted,
  dot: colors.primary,
  rowText: colors.onDark,
  divider: 'rgba(255,255,255,0.12)',
  chipBg: colors.tile2,
  statBg: colors.tile2,
  ghostBg: colors.tile2,
  ghostText: colors.onDark,
  noteText: colors.bodyMuted,
  parallelBg: 'rgba(0, 102, 204, 0.14)',
  parallelBorder: 'rgba(41, 151, 255, 0.45)',
  timerOnBg: 'rgba(0, 102, 204, 0.18)',
  timerOnBorder: colors.primaryFocus,
  timerOffBg: colors.tile3,
  timerOffBorder: 'rgba(255,255,255,0.12)',
  timerOnText: colors.primaryOnDark,
  progressTrack: 'rgba(255,255,255,0.14)',
};

export const cookTokensLight: CookTokens = {
  bg: colors.canvas,
  text: colors.ink,
  muted: colors.inkMuted48,
  kicker: colors.inkMuted80,
  dot: colors.primary,
  rowText: colors.ink,
  divider: colors.hairline,
  chipBg: colors.pearl,
  statBg: colors.parchment,
  ghostBg: colors.pearl,
  ghostText: colors.ink,
  noteText: colors.inkMuted48,
  parallelBg: colors.parchment,
  parallelBorder: colors.hairline,
  timerOnBg: colors.pearl,
  timerOnBorder: colors.primaryFocus,
  timerOffBg: colors.pearl,
  timerOffBorder: colors.hairline,
  timerOnText: colors.primary,
  progressTrack: colors.hairline,
};

export function getCookTokens(theme: 'dark' | 'light'): CookTokens {
  return theme === 'dark' ? cookTokensDark : cookTokensLight;
}
