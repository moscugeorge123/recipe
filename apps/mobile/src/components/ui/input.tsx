import { TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, fonts } from '@/theme/tokens';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  className?: string;
};

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <View className="w-full gap-1">
      {label ? (
        <Text variant="caption" className="font-sans-semibold" tone="icon">
          {label}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        className={`h-14 rounded-[12px] border bg-bg px-4 py-[14px] text-[16px] ${
          error ? 'border-chili' : 'border-crust'
        } ${className ?? ''}`}
        placeholderTextColor={colors.mute}
        style={{
          fontFamily: fonts.regular,
          color: colors.ink,
          letterSpacing: 0.24,
        }}
        {...props}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          className="text-sm"
          style={{ color: colors.accentDanger }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
