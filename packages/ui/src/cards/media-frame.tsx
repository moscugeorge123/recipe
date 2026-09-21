import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { Surface, type SurfaceTone } from '../surface';

export type MediaFrameProps = {
  children?: ReactNode;
  height?: number;
  tone?: SurfaceTone;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** 16px image well used on cook steps. Larger frames are not part of this library. */
export function MediaFrame({
  children,
  height = 176,
  tone = 'container',
  accessibilityLabel,
  style,
}: MediaFrameProps) {
  return (
    <Surface
      tone={tone}
      padding="none"
      elevation="sm"
      clip
      accessibilityLabel={accessibilityLabel}
      style={[{ height, width: '100%' }, style]}
    >
      {children}
    </Surface>
  );
}
