import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { Surface } from '../surface';
import { Text } from '../text';

export type StatusBannerProps = {
  label: string;
  icon?: ReactNode;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function StatusBanner({
  label,
  icon,
  action,
  style,
}: StatusBannerProps) {
  return (
    <Surface
      tone="inverse"
      padding="md"
      elevation="md"
      direction="row"
      align="center"
      justify="between"
      gap="sm"
      style={style}
    >
      {icon}
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      {action}
    </Surface>
  );
}
