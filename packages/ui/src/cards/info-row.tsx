import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { Surface, type SurfaceTone } from '../surface';
import { Text } from '../text';

export type InfoRowProps = {
  icon?: ReactNode;
  label: string;
  value?: string;
  tone?: SurfaceTone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function InfoRow({
  icon,
  label,
  value,
  tone = 'canvas',
  onPress,
  style,
}: InfoRowProps) {
  return (
    <Surface
      tone={tone}
      padding="sm"
      elevation="sm"
      direction="row"
      align="center"
      gap="sm"
      onPress={onPress}
      style={style}
    >
      {icon}
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      {value ? <Text variant="label">{value}</Text> : null}
    </Surface>
  );
}
