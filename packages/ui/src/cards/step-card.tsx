import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Surface } from '../surface';
import { Text } from '../text';
import { useTheme } from '../theme/theme';

export type StepCardProps = {
  index: number | string;
  title: string;
  duration?: string;
  body?: string;
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function StepCard({
  index,
  title,
  duration,
  body,
  active = false,
  onPress,
  style,
}: StepCardProps) {
  const theme = useTheme();

  return (
    <Surface
      tone="low"
      padding="sm"
      elevation="sm"
      direction="row"
      align="start"
      gap="sm"
      onPress={onPress}
      style={style}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active
            ? theme.colors.accentContainer
            : theme.colors.high,
        }}
      >
        <Text
          variant="title"
          style={{
            color: active ? theme.colors.onAccentFixed : theme.colors.ink,
          }}
        >
          {index}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Text variant="title" style={{ flex: 1 }}>
            {title}
          </Text>
          {duration ? <Text variant="caption">{duration}</Text> : null}
        </View>
        {body ? <Text variant="body">{body}</Text> : null}
      </View>
    </Surface>
  );
}
