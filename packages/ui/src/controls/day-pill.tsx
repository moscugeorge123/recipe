import type { StyleProp, ViewStyle } from 'react-native';

import { Surface } from '../surface';
import { Text } from '../text';

export type DayPillProps = {
  weekday: string;
  date: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Weekday selector. Radius is 16px, matching the meal-plan day controls. */
export function DayPill({
  weekday,
  date,
  selected = false,
  onPress,
  style,
}: DayPillProps) {
  return (
    <Surface
      tone={selected ? 'primary' : 'container'}
      padding="sm"
      elevation={selected ? 'sm' : 'none'}
      align="center"
      gap="xs"
      onPress={onPress}
      accessibilityLabel={`${weekday} ${date}`}
      style={[{ minWidth: 42 }, style]}
    >
      <Text variant="label">{weekday}</Text>
      <Text variant="title">{date}</Text>
    </Surface>
  );
}
