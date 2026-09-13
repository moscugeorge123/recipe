import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

type TextVariant =
  'display' | 'title' | 'section' | 'kicker' | 'body' | 'caption' | 'mono';

export type TextTone =
  | 'default'
  | 'muted'
  | 'disabled'
  | 'inverse'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'icon';

type TextProps = RNTextProps & {
  className?: string;
  variant?: TextVariant;
  tone?: TextTone;
};

const variantClass: Record<TextVariant, string> = {
  display: 'text-[27px] leading-[1.14] tracking-[-0.02em]',
  title: 'text-[23px] leading-[1.14] tracking-[-0.02em]',
  section: 'text-[13px] font-bold tracking-[0.04em]',
  kicker: 'text-[11px] tracking-[0.02em]',
  body: 'text-[15.5px] leading-[1.45]',
  caption: 'text-[13.5px] leading-[1.4]',
  mono: 'text-[11.5px] tracking-[0.02em]',
};

const variantFont: Record<TextVariant, string> = {
  display: fonts.manrope800,
  title: fonts.manrope800,
  section: fonts.manrope700,
  kicker: fonts.manrope600,
  body: fonts.manrope500,
  caption: fonts.manrope500,
  mono: fonts.manrope500,
};

const variantTone: Record<TextVariant, TextTone> = {
  display: 'default',
  title: 'default',
  section: 'default',
  kicker: 'primary',
  body: 'default',
  caption: 'muted',
  mono: 'muted',
};

export const toneColors: Record<TextTone, string> = {
  default: colors.espresso,
  muted: colors.olive,
  disabled: colors.sage,
  inverse: colors.steamedMilk,
  primary: colors.paprikaPressed,
  secondary: colors.basil,
  accent: colors.honey,
  icon: colors.cocoa,
};

export function Text({
  className,
  variant = 'body',
  tone,
  style,
  ...props
}: TextProps) {
  const resolvedTone = tone ?? variantTone[variant];

  return (
    <RNText
      className={`${variantClass[variant]} ${className ?? ''}`}
      style={[
        { fontFamily: variantFont[variant], color: toneColors[resolvedTone] },
        style,
      ]}
      {...props}
    />
  );
}
