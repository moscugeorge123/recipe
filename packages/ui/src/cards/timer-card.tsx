import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { Surface } from '../surface';
import { Text } from '../text';

export type TimerCardProps = {
  eyebrow?: string;
  status?: string;
  children?: ReactNode;
  actions?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function TimerCard({
  eyebrow,
  status,
  children,
  actions,
  style,
}: TimerCardProps) {
  return (
    <Surface
      tone="lowest"
      padding="md"
      elevation="md"
      align="center"
      gap="sm"
      style={style}
    >
      {eyebrow ? <Text variant="label">{eyebrow}</Text> : null}
      {status ? <Text variant="caption">{status}</Text> : null}
      {children}
      {actions ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {actions}
        </View>
      ) : null}
    </Surface>
  );
}
