import { useState, type ReactNode } from 'react';
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
  lg: 'h-12 rounded-full px-7',
  md: 'h-12 rounded-full px-7',
  icon: 'h-12 w-12 rounded-full px-0',
};

function variantFill(
  variant: ButtonVariant,
  cookDark: boolean,
  pressed: boolean,
): string | undefined {
  switch (variant) {
    case 'primary':
    case 'inverse':
      if (cookDark) {
        return pressed ? colors.faint : colors.canvasLight;
      }
      return colors.canvasDark;
    case 'secondary':
      return colors.surfaceSoft;
    case 'destructive':
    case 'ghost':
      return cookDark ? colors.canvasDark : colors.canvasLight;
  }
}

function variantLabel(variant: ButtonVariant, cookDark: boolean): string {
  switch (variant) {
    case 'primary':
    case 'inverse':
      return cookDark ? colors.canvasDark : colors.onDark;
    case 'secondary':
      return colors.ink;
    case 'destructive':
      return colors.accentDanger;
    case 'ghost':
      return cookDark ? colors.onDark : colors.ink;
  }
}

function variantBorder(
  variant: ButtonVariant,
  cookDark: boolean,
): string | undefined {
  if (variant === 'ghost' || variant === 'destructive') {
    return cookDark ? colors.onDark : colors.hairlineStrong;
  }
  return undefined;
}

export function Button({
  label,
  icon,
  variant = 'primary',
  size = 'md',
  disabled,
  className,
  style,
  onPressIn,
  onPressOut,
  ...props
}: ButtonProps) {
  const cookDark = useCookTheme().dark;
  const [pressed, setPressed] = useState(false);
  const fill = variantFill(variant, cookDark, pressed);
  const labelColor = variantLabel(variant, cookDark);
  const borderColor = variantBorder(variant, cookDark);
  const isHero = size === 'lg';

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      className={`min-h-12 items-center justify-center ${sizeClasses[size]} ${
        disabled ? 'opacity-50' : ''
      } ${className ?? ''}`}
      style={[
        fill ? { backgroundColor: fill } : undefined,
        borderColor
          ? { borderWidth: 1, borderColor, paddingHorizontal: 27 }
          : undefined,
        disabled ? { opacity: 0.5 } : undefined,
        style,
      ]}
      {...props}
    >
      {icon ?? (
        <Text
          className={isHero ? 'text-[20px] leading-[1.4]' : 'text-[16px]'}
          style={{
            color: labelColor,
            fontFamily: isHero ? fonts.medium : fonts.semibold,
            letterSpacing: isHero ? 0 : 0.24,
          }}
        >
          {label}
        </Text>
      )}
    </PressScale>
  );
}
