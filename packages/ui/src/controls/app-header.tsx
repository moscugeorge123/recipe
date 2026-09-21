import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { Text, type TextVariant } from '../text';
import { useTheme } from '../theme/theme';

export type AppHeaderProps = {
  wordmark?: string;
  title?: string;
  subtitle?: string;
  titleVariant?: Extract<TextVariant, 'display' | 'headline'>;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AppHeader({
  wordmark,
  title,
  subtitle,
  titleVariant = 'headline',
  leading,
  trailing,
  children,
  style,
}: AppHeaderProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 8,
          gap: 12,
          backgroundColor: theme.colors.canvas,
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {leading}
          {wordmark ? <Text variant="label">{wordmark}</Text> : null}
        </View>
        {trailing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {trailing}
          </View>
        ) : null}
      </View>
      {title ? (
        <Text variant={titleVariant} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {subtitle ? <Text variant="body">{subtitle}</Text> : null}
      {children}
    </View>
  );
}
