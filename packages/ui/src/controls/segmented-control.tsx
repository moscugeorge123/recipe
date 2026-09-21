import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { Text } from '../text';
import { shadows } from '../theme/tokens';
import { useTheme } from '../theme/theme';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          padding: 4,
          borderRadius: 9999,
          backgroundColor: theme.colors.high,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 36,
              borderRadius: 9999,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              backgroundColor: selected ? theme.colors.lowest : 'transparent',
              ...(selected ? shadows.sm : null),
            }}
          >
            {option.icon}
            <Text
              variant="label"
              tone={selected ? 'primary' : 'muted'}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
