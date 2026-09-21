import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { cardRadius } from '../theme/tokens';
import { Surface } from '../surface';
import { Text } from '../text';

export type SourceCardProps = {
  thumbnail?: ReactNode;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  thumbnailSize?: number;
  style?: StyleProp<ViewStyle>;
};

export function SourceCard({
  thumbnail,
  icon,
  title,
  subtitle,
  thumbnailSize = 64,
  style,
}: SourceCardProps) {
  return (
    <Surface
      tone="lowest"
      padding="md"
      elevation="sm"
      direction="row"
      align="center"
      gap="sm"
      style={style}
    >
      {thumbnail ? (
        <View
          style={{
            width: thumbnailSize,
            height: thumbnailSize,
            borderRadius: cardRadius,
            overflow: 'hidden',
          }}
        >
          {thumbnail}
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon}
          <Text variant="title" style={{ flex: 1 }} numberOfLines={2}>
            {title}
          </Text>
        </View>
        {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
      </View>
    </Surface>
  );
}
