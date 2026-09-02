import type { ReactNode } from 'react';
import {
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PressScale } from '@/components/ui/press-scale';
import { Text } from '@/components/ui/text';
import { colors, radii, typeface } from '@/theme/tokens';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'inverse';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: 'lg' | 'md' | 'icon';
  className?: string;
  style?: StyleProp<ViewStyle>;
};

const sizeClasses = {
  lg: 'min-h-11 rounded-full px-7 py-3.5',
  md: 'min-h-11 rounded-full px-[22px] py-[11px]',
  icon: 'h-11 w-11 rounded-full px-0',
};

function variantChrome(
  variant: ButtonVariant,
): Pick<ViewStyle, 'backgroundColor' | 'borderColor' | 'borderWidth' | 'borderRadius'> {
  switch (variant) {
    case 'primary':
      return { backgroundColor: colors.primary, borderRadius: radii.pill };
    case 'secondary':
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        borderColor: colors.primary,
        borderWidth: 1,
        borderRadius: radii.pill,
      };
    case 'inverse':
    case 'destructive':
      return { backgroundColor: colors.ink, borderRadius: radii.sm };
  }
}

function variantLabel(variant: ButtonVariant): string {
  switch (variant) {
    case 'primary':
      return colors.onPrimary;
    case 'secondary':
    case 'ghost':
      return colors.primary;
    case 'inverse':
    case 'destructive':
      return colors.onDark;
  }
}

export function Button({
  label,
  icon,
  variant = 'primary',
  size = 'md',
  disabled,
  className,
  style,
  ...props
}: ButtonProps) {
  const chrome = variantChrome(variant);
  const labelColor = variantLabel(variant);
  const storeHero = variant === 'primary' && size === 'lg';
  const utility = variant === 'inverse' || variant === 'destructive';

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      className={`min-h-11 items-center justify-center ${sizeClasses[size]} ${
        disabled ? 'opacity-50' : ''
      } ${className ?? ''}`}
      style={[
        chrome,
        utility && size !== 'icon' ? { paddingHorizontal: 15, paddingVertical: 8 } : undefined,
        disabled ? { opacity: 0.5 } : undefined,
        style,
      ]}
      {...props}
    >
      {icon ?? (
        <Text
          className={
            storeHero
              ? 'text-[18px] leading-[1]'
              : utility
                ? 'text-[14px] leading-[1.29]'
                : 'text-[17px] leading-[1.47]'
          }
          style={{
            color: labelColor,
            letterSpacing: utility ? -0.224 : storeHero ? 0 : -0.374,
            ...typeface(storeHero ? 'light' : 'regular'),
          }}
        >
          {label}
        </Text>
      )}
    </PressScale>
  );
}
