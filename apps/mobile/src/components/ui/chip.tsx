import type { ReactNode } from 'react';
import {
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PressScale } from '@/components/ui/press-scale';
import { Text } from '@/components/ui/text';
import { colors, fonts } from '@/theme/tokens';

type ChipProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  selected?: boolean;
  className?: string;
  icon?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Chip({
  label,
  selected,
  className,
  disabled,
  icon,
  style,
  ...props
}: ChipProps) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      className={`min-h-11 max-w-full flex-row flex-wrap items-center justify-center gap-1.5 rounded-[13px] px-[15px] py-2 ${
        className ?? ''
      }`}
      style={[
        {
          backgroundColor: selected ? colors.cta : colors.paper,
        },
        style,
      ]}
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
    </PressScale>
  );
}
