import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  layoutReorder,
  motionEntering,
  motionExiting,
  useReducedMotion,
  type MotionPreset,
} from '@/lib/motion';

type MotionItemProps = {
  preset: MotionPreset;
  index?: number;
  layout?: boolean;
  reduced?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: ReactNode;
};

export function MotionItem({
  preset,
  index = 0,
  layout = false,
  reduced: reducedOverride,
  className,
  style,
  testID,
  children,
}: MotionItemProps) {
  const systemReduced = useReducedMotion();
  const reduced = reducedOverride ?? systemReduced;

  return (
    <Animated.View
      entering={motionEntering(preset, reduced, index)}
      exiting={motionExiting(preset, reduced)}
      layout={layout ? layoutReorder(reduced) : undefined}
      className={className}
      style={style}
      testID={testID}
    >
      {children}
    </Animated.View>
  );
}
