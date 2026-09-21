import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { ProgressTrack } from './progress-track';

export type CookDockProps = {
  /** 0 to 1. Omit to hide the track. */
  progress?: number;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Frosted cook bar. Translucent fill stands in for backdrop blur. */
export function CookDock({
  progress,
  leading,
  trailing,
  children,
  style,
}: CookDockProps) {
  return (
    <View
      style={[
        {
          backgroundColor: 'rgba(248, 250, 245, 0.92)',
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 12,
          gap: 8,
        },
        style,
      ]}
    >
      {typeof progress === 'number' ? (
        <ProgressTrack value={progress} tone="terracotta" height={4} />
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        {leading}
        <View style={{ flex: 1, alignItems: 'center' }}>{children}</View>
        {trailing}
      </View>
    </View>
  );
}
