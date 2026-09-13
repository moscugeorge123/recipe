import type { ReactNode } from 'react';
import {
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PressScale } from '@/components/ui/press-scale';
import { Text } from '@/components/ui/text';
import { colors, fonts } from '@/theme/tokens';

type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'destructive' | 'inverse';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: 'lg' | 'md' | 'icon';
  className?: string;
  style?: StyleProp<ViewStyle>;
};

const sizeClasses = {
  lg: 'min-h-[56px] w-full rounded-[28px] px-5 py-3',
  md: 'min-h-[48px] rounded-[28px] px-4 py-2',
  icon: 'h-11 w-11 min-h-11 min-w-11 rounded-full px-0',
};

function variantFill(
  variant: ButtonVariant,
  disabled: boolean,
): string | undefined {
  if (variant === 'primary' && disabled) {
    return colors.ctaDisabled;
  }
  switch (variant) {
    case 'primary':
      return colors.cta;
    case 'secondary':
      return colors.basil600;
    case 'inverse':
      return colors.espresso;
    case 'destructive':
      return colors.chili;
    case 'ghost':
      return undefined;
  }
}

function variantLabel(variant: ButtonVariant): string {
  switch (variant) {
    case 'primary':
    case 'secondary':
    case 'destructive':
      return colors.onPrimary;
    case 'inverse':
      return colors.steamedMilk;
    case 'ghost':
      return colors.paprika;
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
  accessibilityState,
  ...props
}: ButtonProps) {
  const fill =
    size === 'icon' && variant === 'ghost'
      ? colors.paper
      : variantFill(variant, !!disabled);
  const labelColor = variantLabel(variant);
  const labelSize =
    variant === 'ghost'
      ? 'text-[14.5px]'
      : variant === 'secondary'
        ? 'text-[15.5px]'
        : 'text-[16.5px]';

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      disabled={disabled}
      className={`min-h-11 items-center justify-center ${sizeClasses[size]} ${
        className ?? ''
      }`}
      style={[
        fill ? { backgroundColor: fill } : undefined,
        disabled && variant !== 'primary' ? { opacity: 0.5 } : undefined,
        style,
      ]}
      {...props}
    >
      {icon ?? (
        <Text
          className={labelSize}
          style={{
            color: labelColor,
            fontFamily:
              variant === 'ghost' ? fonts.manrope600 : fonts.manrope700,
          }}
        >
          {label}
        </Text>
      )}
    </PressScale>
  );
}
