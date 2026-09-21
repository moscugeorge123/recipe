import { Children, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Surface, type SurfaceTone } from '../surface';
import { Text } from '../text';
import { useTheme } from '../theme/theme';

export type GroupCardProps = {
  title?: string;
  meta?: string;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: SurfaceTone;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function GroupCard({
  title,
  meta,
  icon,
  action,
  tone = 'lowest',
  children,
  style,
}: GroupCardProps) {
  const theme = useTheme();
  const items = Children.toArray(children);
  const hasHeader = Boolean(title || meta || icon || action);

  return (
    <Surface tone={tone} padding="none" elevation="sm" clip style={style}>
      {hasHeader ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          {icon}
          <View style={{ flex: 1, gap: 2 }}>
            {title ? <Text variant="title">{title}</Text> : null}
            {meta ? <Text variant="caption">{meta}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      {items.map((child, index) => (
        <View
          key={index}
          style={
            index > 0 || hasHeader
              ? {
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.container,
                }
              : undefined
          }
        >
          {child}
        </View>
      ))}
    </Surface>
  );
}
