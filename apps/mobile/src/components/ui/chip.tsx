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
      className={`min-h-11 max-w-full flex-row flex-wrap items-center justify-center gap-1.5 rounded-[13px] px-[15px] py-2 ${
        className ?? ''
      }`}
      style={{
        backgroundColor: selected ? colors.espresso : colors.peach,
      }}
      {...props}
    >
      {icon}
      <Text
        className="max-w-full text-[13px]"
        tone={selected ? 'inverse' : 'icon'}
        style={{ fontFamily: fonts.manrope600, flexShrink: 1 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
