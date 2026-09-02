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
  display: 'text-[28px] leading-[40px]',
  title: 'text-[22px] leading-[26px] tracking-[-0.44px]',
  section: 'text-[21px] leading-[30px]',
  kicker: 'text-[12px] leading-4',
  body: 'text-base leading-6',
  caption: 'text-sm leading-5',
  mono: 'text-sm leading-5',
};

const variantFont: Record<TextVariant, string> = {
  display: fonts.bold,
  title: fonts.medium,
  section: fonts.bold,
  kicker: fonts.bold,
  body: fonts.regular,
  caption: fonts.regular,
  mono: fonts.medium,
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
  default: colors.espresso,
  muted: colors.olive,
  disabled: colors.sage,
  inverse: colors.steamedMilk,
  primary: colors.paprika,
  secondary: colors.espresso,
  accent: colors.espresso,
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
