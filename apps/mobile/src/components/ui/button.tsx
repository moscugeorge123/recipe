import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from '@/components/ui/text';
import { useCookTheme } from '@/theme/cook-shell';
import { colors, fonts, radii } from '@/theme/tokens';

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
  lg: 'h-12 rounded-cta px-6',
  md: 'h-12 rounded-cta px-6',
  icon: 'h-10 w-10 rounded-full px-0',
};

function chrome(
  variant: ButtonVariant,
  cookDark: boolean,
  pressed: boolean,
  disabled: boolean | undefined,
): { fill?: string; border?: string; label: string; underline: boolean } {
  const ink = cookDark ? colors.onPrimary : colors.espresso;
  const canvas = cookDark ? colors.espresso : colors.cream;

  switch (variant) {
    case 'primary':
      return {
        fill: disabled
          ? colors.paprikaSoft
          : pressed
            ? colors.paprikaPressed
            : colors.paprika,
        label: colors.onPrimary,
        underline: false,
      };
    case 'secondary':
    case 'inverse':
      return {
        fill: canvas,
        border: ink,
        label: ink,
        underline: false,
      };
    case 'destructive':
      return {
        fill: colors.chili,
        label: colors.onPrimary,
        underline: false,
      };
    case 'ghost':
      return {
        label: ink,
        underline: pressed,
      };
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
  onPressIn,
  onPressOut,
  ...props
}: ButtonProps) {
  const cookDark = useCookTheme().dark;
  const [pressed, setPressed] = useState(false);
  const look = chrome(variant, cookDark, pressed, disabled);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      className={`items-center justify-center ${
        size === 'icon' ? 'min-h-10' : 'min-h-12'
      } ${sizeClasses[size]} ${className ?? ''}`}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      style={[
        {
          backgroundColor: look.fill,
          borderRadius: size === 'icon' ? 20 : radii.cta,
          borderWidth: look.border ? 1 : 0,
          borderColor: look.border,
        },
        style,
      ]}
      {...props}
    >
      {icon ?? (
        <Text
          className="text-base leading-5"
          style={{
            color: look.label,
            fontFamily: fonts.medium,
            textDecorationLine: look.underline ? 'underline' : 'none',
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
