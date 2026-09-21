import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { Surface, type SurfaceTone } from '../surface';
import { Text } from '../text';

export type TipCardProps = {
  icon?: ReactNode;
  eyebrow?: string;
  body: string;
  tone?: Extract<SurfaceTone, 'low' | 'container' | 'high' | 'canvas'>;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function TipCard({
  icon,
  eyebrow,
  body,
  tone = 'low',
  action,
  style,
}: TipCardProps) {
  return (
    <Surface
      tone={tone}
      padding="md"
      direction="row"
      align="start"
      gap="sm"
      style={style}
    >
      {icon}
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow ? <Text variant="label">{eyebrow}</Text> : null}
        <Text variant="body">{body}</Text>
        {action}
      </View>
    </Surface>
  );
}
