import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, fonts } from '@/theme/tokens';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  className?: string;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, className, multiline, style, ...props },
  ref,
) {
  return (
    <View className="w-full gap-1">
      {label ? (
        <Text variant="caption" className="font-sans-semibold" tone="icon">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        {...props}
        accessibilityLabel={label}
        accessibilityHint={error}
        aria-invalid={!!error}
        multiline={multiline}
        className={`${
          multiline ? 'min-h-[88px] py-3' : 'min-h-12'
        } rounded-[15px] border bg-peach px-[15px] py-3 text-[15.5px] ${
          error ? 'border-chili' : 'border-crust'
        } ${className ?? ''}`}
        placeholderTextColor={colors.olive}
        style={[
          { fontFamily: fonts.manrope600, color: colors.espresso },
          style,
        ]}
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
});
