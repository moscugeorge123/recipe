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
      className={`h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-full border border-crust bg-bg-elevated ${
        disabled ? 'opacity-50' : ''
      } ${className ?? ''}`}
      {...props}
    >
      {children}
    </Pressable>
  );
}
