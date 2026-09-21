import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { Surface } from '../surface';
import { Text } from '../text';

export type RecipeRowProps = {
  image?: ReactNode;
  title: string;
  meta?: string;
  source?: ReactNode;
  trailing?: ReactNode;
  imageSize?: number;
  titleLines?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function RecipeRow({
  image,
  title,
  meta,
  source,
  trailing,
  imageSize = 72,
  titleLines = 2,
  onPress,
  style,
}: RecipeRowProps) {
  return (
    <Surface
      tone="lowest"
      padding="sm"
      elevation="sm"
      direction="row"
      align="center"
      gap="sm"
      clip
      onPress={onPress}
      style={style}
    >
      {image ? (
        <View style={{ width: imageSize, height: imageSize }}>{image}</View>
      ) : null}
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="title" numberOfLines={titleLines}>
          {title}
        </Text>
        {meta ? <Text variant="caption">{meta}</Text> : null}
        {source}
      </View>
      {trailing}
    </Surface>
  );
}
