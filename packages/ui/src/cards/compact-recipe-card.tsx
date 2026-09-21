import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { Surface } from '../surface';
import { Text } from '../text';

export type CompactRecipeCardProps = {
  title: string;
  time?: string;
  image?: ReactNode;
  width?: number;
  titleLines?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function CompactRecipeCard({
  title,
  time,
  image,
  width = 200,
  titleLines = 2,
  onPress,
  style,
}: CompactRecipeCardProps) {
  return (
    <Surface
      tone="lowest"
      padding="sm"
      elevation="sm"
      gap="xs"
      clip
      onPress={onPress}
      style={[{ width }, style]}
    >
      {image ? <View style={{ height: 96 }}>{image}</View> : null}
      {time ? <Text variant="caption">{time}</Text> : null}
      <Text variant="title" numberOfLines={titleLines}>
        {title}
      </Text>
    </Surface>
  );
}
