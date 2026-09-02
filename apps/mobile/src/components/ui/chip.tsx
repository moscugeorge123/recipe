import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, fonts } from '@/theme/tokens';

type ChipProps = Omit<PressableProps, 'children'> & {
  label: string;
  selected?: boolean;
  className?: string;
  icon?: ReactNode;
  children?: ReactNode;
};

export function Chip({
  label,
  selected,
  className,
  disabled,
  icon,
  ...props
}: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      className={`h-10 min-h-11 flex-row items-center justify-center gap-1.5 px-[15px] ${
        className ?? ''
      }`}
      style={{
        backgroundColor: 'transparent',
        borderBottomWidth: selected ? 2 : 0,
        borderBottomColor: selected ? colors.espresso : 'transparent',
      }}
      {...props}
    >
      {icon}
      <Text
        className="text-sm"
        style={{
          fontFamily: fonts.medium,
          color: selected ? colors.espresso : colors.olive,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
