import {
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';

import { Text } from '../text';
import { useTheme } from '../theme/theme';

export type ChipProps = {
  label: string;
  selected?: boolean;
  icon?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Chip({
  label,
  selected = false,
  icon,
  onPress,
  disabled = false,
  style,
}: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 32,
          paddingHorizontal: 12,
          borderRadius: 9999,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: selected
            ? theme.colors.primary
            : theme.colors.low,
        },
        pressed && !disabled ? { transform: [{ scale: 0.98 }] } : null,
        disabled ? { opacity: 0.5 } : null,
        style,
      ]}
    >
      {icon}
      <Text
        variant="label"
        style={{
          color: selected ? theme.colors.onPrimary : theme.colors.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
