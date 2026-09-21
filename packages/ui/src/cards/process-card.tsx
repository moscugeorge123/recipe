import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { Surface } from '../surface';
import { Text } from '../text';
import { useTheme } from '../theme/theme';

export type ProcessStatus = 'done' | 'active' | 'waiting';

export type ProcessCardProps = {
  status: ProcessStatus;
  title: string;
  detail?: string;
  icon?: ReactNode;
  progress?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ProcessCard({
  status,
  title,
  detail,
  icon,
  progress,
  style,
}: ProcessCardProps) {
  return (
    <Surface
      tone={status === 'waiting' ? 'low' : 'lowest'}
      padding="md"
      elevation={status === 'waiting' ? 'none' : 'sm'}
      direction="row"
      align="start"
      gap="sm"
      style={[status === 'waiting' ? { opacity: 0.75 } : null, style]}
    >
      {icon ?? <StatusMark status={status} />}
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="title">{title}</Text>
        {detail ? <Text variant="body">{detail}</Text> : null}
        {progress}
      </View>
    </Surface>
  );
}

function StatusMark({ status }: { status: ProcessStatus }) {
  const theme = useTheme();
  const backgroundColor =
    status === 'done'
      ? theme.colors.primaryFixed
      : status === 'active'
        ? theme.colors.primary
        : theme.colors.high;
  const color =
    status === 'active' ? theme.colors.onPrimary : theme.colors.primary;
  const glyph = status === 'done' ? '✓' : status === 'active' ? '•' : '–';

  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="label" style={{ color }}>
        {glyph}
      </Text>
    </View>
  );
}
