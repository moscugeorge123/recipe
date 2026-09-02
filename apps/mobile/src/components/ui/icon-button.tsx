import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';

import { colors } from '@/theme/tokens';

type IconButtonProps = PressableProps & {
  accessibilityLabel: string;
  className?: string;
  children: ReactNode;
};

export function IconButton({
  accessibilityLabel,
  className,
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
      style={{ backgroundColor: colors.chipTranslucent }}
      {...props}
    >
      {children}
    </Pressable>
  );
}
