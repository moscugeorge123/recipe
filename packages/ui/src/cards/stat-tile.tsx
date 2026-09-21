import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { Surface, type SurfaceTone } from '../surface';
import { Text } from '../text';

export type StatTileProps = {
  icon?: ReactNode;
  value: string;
  caption: string;
  tone?: SurfaceTone;
  align?: 'center' | 'start';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function StatTile({
  icon,
  value,
  caption,
  tone = 'low',
  align = 'center',
  onPress,
  style,
}: StatTileProps) {
  return (
    <Surface
      tone={tone}
      padding="sm"
      elevation="sm"
      align={align}
      gap="xs"
      onPress={onPress}
      style={style}
    >
      {icon}
      <Text variant="title">{value}</Text>
      <Text variant="caption">{caption}</Text>
    </Surface>
  );
}
