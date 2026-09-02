import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, fonts, radii } from '@/theme/tokens';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  className?: string;
};

export function Input({
  label,
  error,
  className,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View className="w-full gap-1">
      {label ? (
        <Text variant="caption" className="font-sans-semibold" tone="muted">
          {label}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        className={`h-14 bg-bg px-3 text-base ${className ?? ''}`}
        placeholderTextColor={colors.olive}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={{
          fontFamily: fonts.regular,
          color: colors.espresso,
          borderRadius: radii.cta,
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? colors.espresso : colors.crust,
          paddingHorizontal: 12,
          paddingVertical: 14,
        }}
        {...props}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          className="text-sm"
          style={{ color: colors.chili }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
