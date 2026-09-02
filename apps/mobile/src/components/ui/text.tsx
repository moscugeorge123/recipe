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
  display: 'text-[32px] leading-[1.19]',
  title: 'text-[24px] leading-[1.33]',
  section: 'text-[14px] leading-[1.43]',
  kicker: 'text-[14px] leading-[1.43]',
  body: 'text-[16px] leading-[1.5]',
  caption: 'text-[14px] leading-[1.43]',
  mono: 'text-[13px] leading-[1.4]',
};

const variantFont: Record<TextVariant, string> = {
  display: fonts.medium,
  title: fonts.medium,
  section: fonts.semibold,
  kicker: fonts.semibold,
  body: fonts.regular,
  caption: fonts.regular,
  mono: fonts.regular,
};

const variantTracking: Record<TextVariant, number> = {
  display: -0.32,
  title: 0,
  section: 0,
  kicker: 0,
  body: 0.24,
  caption: 0,
  mono: 0,
};

const variantTone: Record<TextVariant, TextTone> = {
  display: 'default',
  title: 'default',
  section: 'default',
  kicker: 'muted',
  body: 'default',
  caption: 'muted',
  mono: 'muted',
};

export const toneColors: Record<TextTone, string> = {
  default: colors.ink,
  muted: colors.mute,
  disabled: colors.stone,
  inverse: colors.onDark,
  primary: colors.link,
  secondary: colors.accentGreenText,
  accent: colors.accentYellow,
  icon: colors.charcoal,
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
        {
          fontFamily: variantFont[variant],
          color: toneColors[resolvedTone],
          letterSpacing: variantTracking[variant],
        },
        style,
      ]}
      {...props}
    />
  );
}
