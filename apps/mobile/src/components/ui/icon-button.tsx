import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';

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
      className={`h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-icon border border-crust bg-bg-elevated ${
        disabled ? 'opacity-50' : ''
      } ${className ?? ''}`}
      {...props}
    >
      {children}
    </Pressable>
  );
}
