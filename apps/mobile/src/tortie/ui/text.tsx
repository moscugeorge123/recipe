import { Text, type TextProps, type TextStyle } from 'react-native';

import { C, F } from '@/tortie/theme';

type Weight = 400 | 500 | 600 | 700;

const SANS: Record<Weight, string> = {
  400: F.sans400,
  500: F.sans500,
  600: F.sans600,
  700: F.sans700,
};
const SERIF: Record<Weight, string> = {
  400: F.serif400,
  500: F.serif500,
  600: F.serif600,
  700: F.serif600,
};

/** Plus Jakarta Sans style fragment. */
export function sans(
  size: number,
  weight: Weight = 400,
  color: string = C.ink,
  extra?: TextStyle,
): TextStyle {
  return {
    fontFamily: SANS[weight],
    fontSize: size,
    color,
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: size + 2,
    ...extra,
  };
}

/** Single-line label inside a button or pill. Tight leading keeps glyphs optically centered. */
export function ctl(
  size: number,
  weight: Weight = 600,
  color: string = C.ink,
  extra?: TextStyle,
): TextStyle {
  return sans(size, weight, color, { lineHeight: size + 2, ...extra });
}

/** Newsreader style fragment. `em` tracking → px. */
export function serif(
  size: number,
  weight: Weight = 500,
  color: string = C.ink,
  extra?: TextStyle,
): TextStyle {
  return { fontFamily: SERIF[weight], fontSize: size, color, ...extra };
}

export function mono(size: number, color: string): TextStyle {
  return { fontFamily: F.mono500, fontSize: size, color };
}

/** CSS letter-spacing in em → RN px. */
export const em = (size: number, v: number) => size * v;

/** 12/700 uppercase kicker, .06em. */
export function kicker(color: string = C.terra, size = 12): TextStyle {
  return {
    fontFamily: F.sans700,
    fontSize: size,
    letterSpacing: em(size, 0.06),
    textTransform: 'uppercase',
    color,
  };
}

export function T(props: TextProps) {
  return <Text allowFontScaling={false} {...props} />;
}
