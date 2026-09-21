import type { ReactNode } from 'react';
import {
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from '../text';
import { useTheme } from '../theme/theme';

export type CheckRowProps = {
  checked: boolean;
  title: string;
  meta?: string;
  trailing?: ReactNode;
  checkedIcon?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function CheckRow({
  checked,
  title,
  meta,
  trailing,
  checkedIcon,
  onPress,
  disabled = false,
  style,
}: CheckRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={title}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          gap: 2,
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
        pressed && !disabled ? { opacity: 0.7 } : null,
        disabled ? { opacity: 0.5 } : null,
        style,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: checked ? theme.colors.primary : 'transparent',
            borderWidth: checked ? 0 : 1.5,
            borderColor: theme.colors.outlineVariant,
          }}
        >
          {checked
            ? (checkedIcon ?? (
                <Text
                  variant="label"
                  tone="onPrimary"
                  style={{ includeFontPadding: false, textAlignVertical: 'center' }}
                >
                  ✓
                </Text>
              ))
            : null}
        </View>
        <Text
          variant="body"
          style={[
            {
              flex: 1,
              lineHeight: 24,
              includeFontPadding: false,
              textAlignVertical: 'center',
            },
            checked
              ? {
                  textDecorationLine: 'line-through',
                  color: theme.colors.meadow,
                }
              : null,
          ]}
        >
          {title}
        </Text>
        {trailing}
      </View>
      {meta ? (
        <Text variant="caption" style={{ marginLeft: 36 }}>
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}
