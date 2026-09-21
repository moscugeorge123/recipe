import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme';

export type ProgressTrackProps = {
  /** Progress from 0 to 1. */
  value: number;
  tone?: 'sage' | 'terracotta';
  height?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function ProgressTrack({
  value,
  tone = 'sage',
  height = 8,
  accessibilityLabel,
  style,
}: ProgressTrackProps) {
  const theme = useTheme();
  const width = `${Math.min(1, Math.max(0, value)) * 100}%` as const;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={[
        {
          height,
          borderRadius: 9999,
          overflow: 'hidden',
          backgroundColor: theme.colors.container,
        },
        style,
      ]}
    >
      <View
        style={{
          width,
          height: '100%',
          borderRadius: 9999,
          backgroundColor:
            tone === 'terracotta' ? theme.colors.accent : theme.colors.primary,
        }}
      />
    </View>
  );
}
