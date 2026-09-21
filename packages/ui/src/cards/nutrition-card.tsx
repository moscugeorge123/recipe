import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { Surface } from '../surface';
import { Text } from '../text';

export type NutritionCardProps = {
  title: string;
  value: string;
  goal?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function NutritionCard({
  title,
  value,
  goal,
  children,
  style,
}: NutritionCardProps) {
  return (
    <Surface tone="low" padding="sm" elevation="sm" gap="sm" style={style}>
      <Text variant="label">{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text variant="headline">{value}</Text>
        {goal ? (
          <Text variant="body" tone="muted">
            / {goal}
          </Text>
        ) : null}
      </View>
      {children}
    </Surface>
  );
}
