import { TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/text';
import { colors, typeface } from '@/theme/tokens';

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
        className={`h-11 rounded-full border bg-bg px-5 text-[17px] ${
          error ? 'border-crust' : ''
        } ${className ?? ''}`}
        placeholderTextColor={colors.inkMuted48}
        style={{
          ...typeface('regular'),
          color: colors.ink,
          letterSpacing: -0.374,
          borderColor: colors.searchBorder,
          minHeight: 44,
        }}
        {...props}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          className="text-sm"
          variant="caption"
          tone="muted"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
