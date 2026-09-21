import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { Surface } from '../surface';
import { Text } from '../text';

export type DropSlotProps = {
  title: string;
  hint?: string;
  icon?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function DropSlot({
  title,
  hint,
  icon,
  onPress,
  style,
}: DropSlotProps) {
  return (
    <Surface
      tone="low"
      padding="sm"
      elevation="sm"
      direction="row"
      align="center"
      justify="between"
      gap="sm"
      onPress={onPress}
      style={style}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title">{title}</Text>
        {hint ? <Text variant="caption">{hint}</Text> : null}
      </View>
      {icon}
    </Surface>
  );
}
