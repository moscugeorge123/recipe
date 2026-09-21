import {
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';

import { useTheme } from '../theme/theme';

export type SearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Pill search used in the app header. The 48px import-sheet field is not included. */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  icon,
  trailing,
  accessibilityLabel = 'Search',
  style,
}: SearchFieldProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          minHeight: 44,
          paddingHorizontal: 14,
          borderRadius: 9999,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: theme.colors.low,
        },
        style,
      ]}
    >
      {icon}
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        style={{
          flex: 1,
          fontFamily: theme.fonts.body,
          fontSize: 14,
          lineHeight: 20,
          color: theme.colors.ink,
          paddingVertical: 8,
        }}
      />
      {trailing}
    </View>
  );
}
