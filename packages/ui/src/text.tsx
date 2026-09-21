import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme, useTone } from './theme/theme';

export type TextVariant =
  | 'display'
  | 'headline'
  | 'title'
  | 'body'
  | 'label'
  | 'caption'
  | 'mono';

export type TextTone =
  | 'default'
  | 'muted'
  | 'primary'
  | 'accent'
  | 'inverse'
  | 'onPrimary';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
};

const variantStyle: Record<TextVariant, TextStyle> = {
  display: { fontSize: 32, lineHeight: 38, letterSpacing: -0.48 },
  headline: { fontSize: 22, lineHeight: 28, letterSpacing: -0.22 },
  title: { fontSize: 16, lineHeight: 22, letterSpacing: -0.16 },
  body: { fontSize: 14, lineHeight: 22 },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 0.24 },
  caption: { fontSize: 13, lineHeight: 18 },
  mono: { fontSize: 12, lineHeight: 16, letterSpacing: 0.12 },
};

export function Text({
  variant = 'body',
  tone = 'default',
  style,
  ...props
}: TextProps) {
  const theme = useTheme();
  const surface = useTone();
  const fontFamily = fontFor(theme.fonts, variant);

  return (
    <RNText
      {...props}
      style={[
        variantStyle[variant],
        { fontFamily, color: resolveColor(variant, tone, theme.colors, surface) },
        style,
      ]}
    />
  );
}

function fontFor(
  families: ReturnType<typeof useTheme>['fonts'],
  variant: TextVariant,
): string {
  switch (variant) {
    case 'display':
      return families.display;
    case 'headline':
      return families.headline;
    case 'title':
      return families.title;
    case 'label':
      return families.label;
    case 'mono':
      return families.mono;
    case 'body':
    case 'caption':
      return families.body;
  }
}

function resolveColor(
  variant: TextVariant,
  tone: TextTone,
  palette: ReturnType<typeof useTheme>['colors'],
  surface: ReturnType<typeof useTone>,
): string {
  switch (tone) {
    case 'muted':
      return surface?.muted ?? palette.muted;
    case 'primary':
      return palette.primary;
    case 'accent':
      return palette.accent;
    case 'inverse':
      return palette.onInverse;
    case 'onPrimary':
      return palette.onPrimary;
    case 'default':
      if (variant === 'caption') return surface?.muted ?? palette.muted;
      return surface?.color ?? palette.ink;
  }
}
