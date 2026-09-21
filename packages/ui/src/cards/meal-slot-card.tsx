import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { Surface } from '../surface';
import { Text } from '../text';

export type MealSlotCardProps = {
  meal: string;
  time?: string;
  kcal?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  titleLines?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function MealSlotCard({
  meal,
  time,
  kcal,
  title,
  subtitle,
  badge,
  leading,
  trailing,
  titleLines = 2,
  onPress,
  style,
}: MealSlotCardProps) {
  const schedule = [meal, time].filter(Boolean).join(' · ');

  return (
    <Surface
      tone="lowest"
      padding="sm"
      elevation="sm"
      direction="row"
      align="center"
      gap="sm"
      onPress={onPress}
      style={style}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
            {schedule}
          </Text>
          {kcal ? <Text variant="caption">{kcal}</Text> : null}
        </View>
        <Text variant="title" numberOfLines={titleLines}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {badge ? <Text variant="label">{badge}</Text> : null}
      </View>
      {trailing}
    </Surface>
  );
}
