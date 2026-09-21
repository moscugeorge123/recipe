import {
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';

import { ToneProvider, useTheme } from './theme/theme';
import {
  cardRadius,
  shadows,
  spacing,
  tonePalette,
  type SurfaceTone,
} from './theme/tokens';

export type { SurfaceTone };

export type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';
export type SurfaceElevation = 'none' | 'sm' | 'md';
export type SurfaceGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | number;
export type SurfaceAlign = 'start' | 'center' | 'end' | 'stretch';
export type SurfaceJustify = 'start' | 'center' | 'end' | 'between';

export type SurfaceProps = {
  tone?: SurfaceTone;
  padding?: SurfacePadding;
  elevation?: SurfaceElevation;
  direction?: 'column' | 'row';
  align?: SurfaceAlign;
  justify?: SurfaceJustify;
  gap?: SurfaceGap;
  /** Clips children to the 16px corners. Radius itself stays fixed. */
  clip?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  children?: ReactNode;
};

const paddingValue: Record<SurfacePadding, number> = {
  none: 0,
  sm: 12,
  md: spacing.md,
  lg: spacing.lg,
};

const alignValue: Record<SurfaceAlign, ViewStyle['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

const justifyValue: Record<SurfaceJustify, ViewStyle['justifyContent']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
};

export function Surface({
  tone = 'lowest',
  padding = 'md',
  elevation = 'none',
  direction = 'column',
  align = 'stretch',
  justify = 'start',
  gap = 'none',
  clip = false,
  onPress,
  disabled = false,
  style,
  testID,
  accessibilityLabel,
  children,
}: SurfaceProps) {
  const theme = useTheme();
  const palette = tonePalette(theme.colors, tone);
  const base: ViewStyle = {
    backgroundColor: palette.backgroundColor,
    borderRadius: cardRadius,
    padding: paddingValue[padding],
    flexDirection: direction,
    alignItems: alignValue[align],
    justifyContent: justifyValue[justify],
    gap: gapValue(gap),
    overflow: clip ? 'hidden' : 'visible',
    ...(elevation === 'sm' ? shadows.sm : null),
    ...(elevation === 'md' ? shadows.md : null),
  };

  const body = <ToneProvider value={palette}>{children}</ToneProvider>;

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [
          base,
          pressed && !disabled ? { transform: [{ scale: 0.98 }] } : null,
          disabled ? { opacity: 0.5 } : null,
          style,
        ]}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[base, style]}
    >
      {body}
    </View>
  );
}

function gapValue(gap: SurfaceGap): number {
  if (typeof gap === 'number') return gap;
  switch (gap) {
    case 'none':
      return 0;
    case 'xs':
      return spacing.xs;
    case 'sm':
      return spacing.sm;
    case 'md':
      return spacing.md;
    case 'lg':
      return spacing.lg;
  }
}
