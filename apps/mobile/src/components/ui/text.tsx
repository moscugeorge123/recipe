import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, substitutingInter, typeface } from '@/theme/tokens';

type TypeWeight = 'light' | 'regular' | 'semibold' | 'bold';

type TextVariant =
  | 'display'
  | 'title'
  | 'section'
  | 'kicker'
  | 'body'
  | 'caption'
  | 'mono';

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

const bodyLeading = substitutingInter ? 1.44 : 1.47;
const displayTracking = substitutingInter ? -0.714 : -0.374;

const variantClass: Record<TextVariant, string> = {
  display: 'text-[34px] leading-[1.47]',
  title: 'text-[28px] leading-[1.14]',
  section: 'text-[14px] leading-[1.29]',
  kicker: 'text-[12px] leading-[1]',
  body: 'text-[17px]',
  caption: 'text-[14px] leading-[1.43]',
  mono: 'text-[12px] leading-[1]',
};

const variantWeight: Record<TextVariant, TypeWeight> = {
  display: 'semibold',
  title: 'regular',
  section: 'semibold',
  kicker: 'regular',
  body: 'regular',
  caption: 'regular',
  mono: 'regular',
};

const variantTracking: Record<TextVariant, number> = {
  display: displayTracking,
  title: 0.196,
  section: -0.224,
  kicker: -0.12,
  body: -0.374,
  caption: -0.224,
  mono: -0.12,
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
  muted: colors.inkMuted48,
  disabled: colors.inkMuted48,
  inverse: colors.onDark,
  primary: colors.primary,
  secondary: colors.primary,
  accent: colors.primary,
  icon: colors.ink,
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
          ...typeface(variantWeight[variant]),
          color: toneColors[resolvedTone],
          letterSpacing: variantTracking[variant],
          ...(variant === 'body' ? { lineHeight: 17 * bodyLeading } : {}),
        },
        style,
      ]}
      {...props}
    />
  );
}
