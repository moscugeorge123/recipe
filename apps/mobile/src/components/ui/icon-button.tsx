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
      className={`h-10 min-h-10 w-10 min-w-10 items-center justify-center rounded-full border border-crust bg-bg ${
        disabled ? 'opacity-50' : ''
      } ${className ?? ''}`}
      {...props}
    >
      {children}
    </Pressable>
  );
}
