import type { ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/theme/tokens';

type IconButtonProps = Omit<PressableProps, 'style'> & {
  accessibilityLabel: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** 44×44 round paper disc for header / chrome icon actions. */
export function IconButton({
  accessibilityLabel,
  className,
  style,
  children,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      className={`h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full ${
        disabled ? 'opacity-50' : ''
      } ${className ?? ''}`}
      style={[{ backgroundColor: colors.paper }, style]}
      {...props}
    >
      {children}
    </Pressable>
  );
}
