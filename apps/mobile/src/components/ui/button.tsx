import type { ReactNode } from 'react';
import {
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PressScale } from '@/components/ui/press-scale';
import { Text } from '@/components/ui/text';
import { useCookTheme } from '@/theme/cook-shell';
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
  lg: 'min-h-[56px] rounded-[17px] px-5 py-3',
  md: 'min-h-[48px] rounded-[15px] px-4 py-2',
  icon: 'h-11 w-11 min-h-11 min-w-11 rounded-[14px] px-0',
};

function variantFill(
  variant: ButtonVariant,
  cookDark: boolean,
): string | undefined {
  switch (variant) {
    case 'primary':
      return cookDark ? colors.paprika400 : colors.paprika;
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

function variantLabel(variant: ButtonVariant, cookDark: boolean): string {
  switch (variant) {
    case 'primary':
      return cookDark ? colors.espresso : colors.onPrimary;
    case 'secondary':
    case 'destructive':
      return colors.onPrimary;
    case 'inverse':
      return colors.steamedMilk;
    case 'ghost':
      return colors.paprikaPressed;
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
  const cookDark = useCookTheme().dark;
  const fill = variantFill(variant, cookDark);
  const labelColor = variantLabel(variant, cookDark);
  const labelSize =
    variant === 'ghost'
      ? 'text-[14.5px]'
      : variant === 'secondary'
        ? 'text-[15.5px]'
        : 'text-[16.5px]';

  const shadowStyle: StyleProp<ViewStyle> =
    variant === 'primary' && size === 'lg'
      ? {
          shadowColor: colors.paprika,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.28,
          shadowRadius: 18,
          elevation: 6,
        }
      : undefined;

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      disabled={disabled}
      className={`min-h-11 items-center justify-center ${sizeClasses[size]} ${
        disabled ? 'opacity-50' : ''
      } ${className ?? ''}`}
      style={[
        shadowStyle,
        fill ? { backgroundColor: fill } : undefined,
        disabled ? { opacity: 0.5 } : undefined,
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
