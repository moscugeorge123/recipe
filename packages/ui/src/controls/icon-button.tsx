import {
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';

import { useTheme } from '../theme/theme';

export type IconButtonProps = {
  accessibilityLabel: string;
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'low' | 'container' | 'primary' | 'accent';
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  accessibilityLabel,
  children,
  onPress,
  disabled = false,
  tone = 'low',
  size = 44,
  style,
}: IconButtonProps) {
  const theme = useTheme();
  const backgroundColor =
    tone === 'primary'
      ? theme.colors.primary
      : tone === 'accent'
        ? theme.colors.accent
        : tone === 'container'
          ? theme.colors.container
          : theme.colors.low;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor,
        },
        pressed && !disabled ? { transform: [{ scale: 0.98 }] } : null,
        disabled ? { opacity: 0.5 } : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
