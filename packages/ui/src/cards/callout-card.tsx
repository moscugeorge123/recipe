import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { Surface } from '../surface';
import { Text } from '../text';

export type CalloutCardProps = {
  tone?: 'primary' | 'accent';
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function CalloutCard({
  tone = 'primary',
  icon,
  title,
  body,
  action,
  style,
}: CalloutCardProps) {
  return (
    <Surface
      tone={tone}
      padding="md"
      elevation={tone === 'primary' ? 'md' : 'sm'}
      gap="sm"
      style={style}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon}
        <Text variant="title" style={{ flex: 1 }}>
          {title}
        </Text>
      </View>
      {body ? <Text variant="body">{body}</Text> : null}
      {action}
    </Surface>
  );
}
