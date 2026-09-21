import {
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';

import { Text } from '../text';
import { useTheme } from '../theme/theme';

export type PillButtonVariant = 'primary' | 'accent' | 'tonal' | 'ghost';
export type PillButtonSize = 'md' | 'lg';

export type PillButtonProps = {
  label: string;
  icon?: ReactNode;
  variant?: PillButtonVariant;
  size?: PillButtonSize;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function PillButton({
  label,
  icon,
  variant = 'primary',
  size = 'md',
  onPress,
  disabled = false,
  style,
  accessibilityLabel,
}: PillButtonProps) {
  const theme = useTheme();
  const minHeight = size === 'lg' ? 48 : 40;
  const paddingHorizontal = size === 'lg' ? 18 : 14;
  const colors = fill(theme.colors, variant);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight,
          paddingHorizontal,
          borderRadius: 9999,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: colors.backgroundColor,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: theme.colors.outlineVariant,
        },
        pressed && !disabled ? { transform: [{ scale: 0.98 }] } : null,
        disabled ? { opacity: 0.5 } : null,
        style,
      ]}
    >
      {icon}
      <Text
        variant="label"
        style={{ color: colors.color, fontSize: size === 'lg' ? 14 : 12 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function fill(
  palette: ReturnType<typeof useTheme>['colors'],
  variant: PillButtonVariant,
): { backgroundColor: string; color: string } {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: palette.primary,
        color: palette.onPrimary,
      };
    case 'accent':
      return {
        backgroundColor: palette.accent,
        color: palette.onAccent,
      };
    case 'tonal':
      return { backgroundColor: palette.low, color: palette.ink };
    case 'ghost':
      return { backgroundColor: 'transparent', color: palette.ink };
  }
}
